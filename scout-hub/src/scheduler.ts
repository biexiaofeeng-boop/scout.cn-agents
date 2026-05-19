import { ScoutPipeline } from "./pipeline.js";
import { OpsActionService } from "./ops/opsActionService.js";
import { OpsScheduleService } from "./ops/opsScheduleService.js";

const SCHEDULE_TICK_MS = 60_000;

export async function runScheduler(pipeline: ScoutPipeline, intervalSec: number): Promise<void> {
  const safeInterval = Math.max(5, intervalSec);
  const opsActionService = new OpsActionService(pipeline);
  const opsScheduleService = new OpsScheduleService(pipeline.settings.runtimeRoot);
  if (!pipeline.settings.pipelineTickEnabled) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ event: "scheduler_pipeline_tick_disabled" }));
  }
  let lastPipelineTickAt = 0;
  for (;;) {
    const now = Date.now();
    if (pipeline.settings.pipelineTickEnabled && now - lastPipelineTickAt >= safeInterval * 1000) {
      lastPipelineTickAt = now;
      try {
        const run = await pipeline.runOnce();
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(run));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(JSON.stringify({ event: "pipeline_run_failed", error: String(err) }));
      }
    }
    try {
      const triggered = await opsScheduleService.runDue(opsActionService);
      if (triggered.length > 0) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ event: "schedules_triggered", count: triggered.length, ids: triggered }));
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ event: "schedule_tick_failed", error: String(err) }));
    }
    await new Promise((r) => setTimeout(r, SCHEDULE_TICK_MS));
  }
}
