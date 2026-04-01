import { ScoutPipeline } from "./pipeline.js";

export async function runScheduler(pipeline: ScoutPipeline, intervalSec: number): Promise<void> {
  const safeInterval = Math.max(5, intervalSec);
  for (;;) {
    const run = await pipeline.runOnce();
    // Keep console output concise for ops collection.
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(run));
    await new Promise((r) => setTimeout(r, safeInterval * 1000));
  }
}
