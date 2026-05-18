import Fastify from "fastify";
import { OpsActionService } from "./ops/opsActionService.js";
import { OpsReviewService } from "./ops/opsReviewService.js";
import { OpsService } from "./ops/opsService.js";
import { renderOpsPage } from "./ops/opsPages.js";
import type { OpsActionName } from "./ops/types.js";
import { ScoutPipeline } from "./pipeline.js";

export async function startMonitorApi(pipeline: ScoutPipeline, host: string, port: number): Promise<void> {
  const app = Fastify({ logger: true });
  const opsService = new OpsService(pipeline);
  const opsActionService = new OpsActionService(pipeline);
  const opsReviewService = new OpsReviewService(pipeline.settings.runtimeRoot);

  app.get("/health", async () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      ...(await pipeline.currentHealth()),
    };
  });

  app.get("/metrics", async () => pipeline.currentHealth());

  app.get("/runs", async (req) => {
    const q = req.query as { limit?: string };
    const limit = Math.max(1, Math.min(200, Number(q.limit || 20)));
    return { runs: await pipeline.store.recentRuns(limit) };
  });

  app.post("/run-once", async () => pipeline.runOnce());

  app.get("/ops/overview.json", async () => opsService.buildOverview());

  app.post("/ops/runs/cleanup", async () => opsActionService.cleanupRuns());

  app.post("/ops/runs/:action", async (req, reply) => {
    const action = (req.params as { action?: string }).action as OpsActionName;
    if (!["collect-topic", "normalize-topic", "collect-and-normalize-topic"].includes(action)) {
      reply.status(404);
      return { error: "unsupported_action" };
    }
    try {
      return await opsActionService.run(action, (req.body || {}) as Record<string, unknown>);
    } catch (err) {
      reply.status(400);
      return {
        error: "ops_action_rejected",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  });

  app.get("/ops/runs/:runId", async (req, reply) => {
    const run = await opsActionService.readRun((req.params as { runId: string }).runId);
    if (!run) {
      reply.status(404);
      return { error: "run_not_found" };
    }
    return run;
  });

  app.get("/ops/runs/:runId/logs", async (req) => {
    return { logs: await opsActionService.readRunLogs((req.params as { runId: string }).runId) };
  });

  app.post("/ops/runs/:runId/retry", async (req, reply) => {
    try {
      return await opsActionService.retry((req.params as { runId: string }).runId);
    } catch (err) {
      reply.status(400);
      return {
        error: "ops_retry_rejected",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  });

  app.get("/ops/review-queue", async () => ({ items: await opsReviewService.list(100) }));

  app.post("/ops/review-queue/:id/decision", async (req, reply) => {
    const body = (req.body || {}) as { status?: string; reviewer?: string; decisionNote?: string };
    if (body.status !== "approved" && body.status !== "rejected") {
      reply.status(400);
      return { error: "invalid_review_status" };
    }
    const item = await opsReviewService.decide(
      (req.params as { id: string }).id,
      body.status,
      body.reviewer,
      body.decisionNote,
    );
    if (!item) {
      reply.status(404);
      return { error: "review_item_not_found" };
    }
    return item;
  });

  app.get("/ops", async (_req, reply) => {
    const overview = await opsService.buildOverview();
    reply.type("text/html; charset=utf-8");
    return renderOpsPage(overview);
  });

  app.get("/alerts", async () => {
    const health = await pipeline.currentHealth();
    const alerts: Array<{ level: string; code: string; message: string }> = [];

    if (health.dlqSize >= pipeline.settings.alertDlqThreshold) {
      alerts.push({
        level: "warning",
        code: "DLQ_THRESHOLD",
        message: `DLQ size=${health.dlqSize}, threshold=${pipeline.settings.alertDlqThreshold}`,
      });
    }

    if (health.metrics.runsFailed > 0) {
      alerts.push({
        level: "warning",
        code: "PIPELINE_FAILURE",
        message: `pipeline failures observed=${health.metrics.runsFailed}`,
      });
    }

    return { alerts };
  });

  await app.listen({ host, port });
}
