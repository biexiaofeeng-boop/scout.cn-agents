import Fastify from "fastify";
import { ScoutPipeline } from "./pipeline.js";

export async function startMonitorApi(pipeline: ScoutPipeline, host: string, port: number): Promise<void> {
  const app = Fastify({ logger: true });

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
