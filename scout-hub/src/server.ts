import Fastify from "fastify";
import { OpsActionService } from "./ops/opsActionService.js";
import { OpsReviewService } from "./ops/opsReviewService.js";
import { OpsScheduleService, type OpsScheduleCreateInput, type OpsScheduleUpdateInput } from "./ops/opsScheduleService.js";
import { OpsService } from "./ops/opsService.js";
import { renderOpsPage, renderRunDetailPage, renderReviewPreviewPage, renderTopicDetailPage } from "./ops/opsPages.js";
import type { OpsActionName } from "./ops/types.js";
import { ScoutPipeline } from "./pipeline.js";

export async function startMonitorApi(pipeline: ScoutPipeline, host: string, port: number): Promise<void> {
  const app = Fastify({ logger: true });
  const opsService = new OpsService(pipeline);
  const opsActionService = new OpsActionService(pipeline);
  const opsReviewService = new OpsReviewService(pipeline.settings.runtimeRoot);
  const opsScheduleService = new OpsScheduleService(pipeline.settings.runtimeRoot);

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

  app.post("/ops/providers/:id/test", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const probes: Record<string, { url: string; requiredEnv?: string; description: string }> = {
      steam: {
        url: "https://store.steampowered.com/api/storesearch/?term=test&l=en&cc=US",
        description: "Steam store search",
      },
      reddit: {
        url: "https://www.reddit.com/search.json?q=test&limit=1",
        description: "Reddit public JSON",
      },
      youtube: {
        url: "https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&type=video&q=test",
        requiredEnv: "YOUTUBE_API_KEY",
        description: "YouTube Data API",
      },
      mediacrawler: {
        url: `${pipeline.settings.mediaCrawlerApiUrl.replace(/\/$/, "")}/api/health`,
        description: "MediaCrawler FastAPI service",
      },
      "wechat-spider": {
        url: "http://127.0.0.1:8080/",
        description: "WeChat spider docker service",
      },
    };
    const probe = probes[id];
    if (!probe) {
      reply.status(400);
      return { error: "unsupported_provider", supported: Object.keys(probes) };
    }
    if (probe.requiredEnv && !process.env[probe.requiredEnv]) {
      reply.status(412);
      return { ok: false, reason: "missing_env", env: probe.requiredEnv };
    }
    const url = probe.requiredEnv ? `${probe.url}&key=${encodeURIComponent(process.env[probe.requiredEnv] as string)}` : probe.url;
    const startedAt = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "ScoutOps/0.1 test-probe" },
      });
      clearTimeout(timer);
      const elapsedMs = Date.now() - startedAt;
      if (!response.ok) {
        return {
          ok: false,
          reason: response.status === 429 ? "rate_limit" : response.status === 401 || response.status === 403 ? "auth" : "upstream",
          httpStatus: response.status,
          elapsedMs,
          target: url,
        };
      }
      return { ok: true, httpStatus: response.status, elapsedMs, target: probe.description };
    } catch (err) {
      const elapsedMs = Date.now() - startedAt;
      const message = err instanceof Error ? err.message : String(err);
      const isConnRefused = /ECONNREFUSED|connect/i.test(message);
      return {
        ok: false,
        reason: message.includes("abort") ? "timeout" : isConnRefused ? "service_down" : "network",
        elapsedMs,
        message,
        target: probe.description,
      };
    }
  });

  app.get("/ops/schedules", async () => ({ items: await opsScheduleService.list(200) }));

  app.get("/ops/schedules/:id", async (req, reply) => {
    const item = await opsScheduleService.get((req.params as { id: string }).id);
    if (!item) {
      reply.status(404);
      return { error: "schedule_not_found" };
    }
    return item;
  });

  app.post("/ops/schedules", async (req, reply) => {
    try {
      return await opsScheduleService.create((req.body || {}) as OpsScheduleCreateInput);
    } catch (err) {
      reply.status(400);
      return { error: "schedule_create_rejected", message: err instanceof Error ? err.message : String(err) };
    }
  });

  app.patch("/ops/schedules/:id", async (req, reply) => {
    try {
      const item = await opsScheduleService.update((req.params as { id: string }).id, (req.body || {}) as OpsScheduleUpdateInput);
      if (!item) {
        reply.status(404);
        return { error: "schedule_not_found" };
      }
      return item;
    } catch (err) {
      reply.status(400);
      return { error: "schedule_update_rejected", message: err instanceof Error ? err.message : String(err) };
    }
  });

  app.delete("/ops/schedules/:id", async (req, reply) => {
    const ok = await opsScheduleService.delete((req.params as { id: string }).id);
    if (!ok) {
      reply.status(404);
      return { error: "schedule_not_found" };
    }
    return { deleted: true };
  });

  app.post("/ops/schedules/:id/run-now", async (req, reply) => {
    try {
      const result = await opsScheduleService.runNow((req.params as { id: string }).id, opsActionService);
      if (!result) {
        reply.status(404);
        return { error: "schedule_not_found" };
      }
      return result;
    } catch (err) {
      reply.status(400);
      return { error: "schedule_run_now_rejected", message: err instanceof Error ? err.message : String(err) };
    }
  });

  app.get("/ops/topics/:topicId", async (req, reply) => {
    const topicId = (req.params as { topicId: string }).topicId;
    const overview = await opsService.buildOverview();
    const topic = overview.topics.find((t) => t.id === topicId);
    if (!topic) {
      reply.status(404);
      reply.type("text/html; charset=utf-8");
      return `<!doctype html><meta charset="utf-8"><title>Topic not found</title><body style="font-family:system-ui;padding:40px"><h1>Topic not found</h1><p>Topic id: <code>${topicId.replace(/[<>&"]/g, "")}</code></p><p><a href="/ops/topics">← Back to Topics</a></p></body>`;
    }
    reply.type("text/html; charset=utf-8");
    return renderTopicDetailPage(topic, overview);
  });

  app.get("/ops/runs/:runId/view", async (req, reply) => {
    const run = await opsActionService.readRun((req.params as { runId: string }).runId);
    if (!run) {
      reply.status(404);
      return { error: "run_not_found" };
    }
    reply.type("text/html; charset=utf-8");
    return renderRunDetailPage(run);
  });

  app.get("/ops/review-queue/:id/preview", async (req, reply) => {
    const preview = await opsReviewService.getPreview((req.params as { id: string }).id);
    if (!preview) {
      reply.status(404);
      return { error: "review_item_not_found" };
    }
    reply.type("text/html; charset=utf-8");
    return renderReviewPreviewPage(preview);
  });

  app.get("/ops/review-queue/:id/preview.json", async (req, reply) => {
    const preview = await opsReviewService.getPreview((req.params as { id: string }).id);
    if (!preview) {
      reply.status(404);
      return { error: "review_item_not_found" };
    }
    return preview;
  });

  const VALID_OPS_TABS = ["dashboard", "topics", "collection", "review", "system"] as const;

  app.get("/ops", async (_req, reply) => {
    const overview = await opsService.buildOverview();
    reply.type("text/html; charset=utf-8");
    return renderOpsPage(overview, { initialTab: "dashboard" });
  });

  app.get("/ops/:tab", async (req, reply) => {
    const tab = (req.params as { tab: string }).tab;
    if (!(VALID_OPS_TABS as readonly string[]).includes(tab)) {
      reply.status(404);
      return { error: "unknown_tab", validTabs: VALID_OPS_TABS };
    }
    const overview = await opsService.buildOverview();
    reply.type("text/html; charset=utf-8");
    return renderOpsPage(overview, { initialTab: tab });
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
