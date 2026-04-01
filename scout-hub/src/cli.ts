import { loadSettings } from "./config.js";
import { ScoutPipeline } from "./pipeline.js";
import { startMonitorApi } from "./server.js";
import { runScheduler } from "./scheduler.js";

function arg(name: string, defaultValue?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return defaultValue;
}

async function main(): Promise<void> {
  const cmd = process.argv[2] || "pipeline";
  const settings = loadSettings();
  const pipeline = new ScoutPipeline(settings);

  if (cmd === "pipeline") {
    const result = await pipeline.runOnce();
    console.log(JSON.stringify(result));
    return;
  }

  if (cmd === "scheduler") {
    const interval = Number(arg("--interval", String(settings.schedulerIntervalSec)));
    await runScheduler(pipeline, interval);
    return;
  }

  if (cmd === "api") {
    const host = arg("--host", settings.monitorHost) as string;
    const port = Number(arg("--port", String(settings.monitorPort)));
    await startMonitorApi(pipeline, host, port);
    return;
  }

  console.error(`unknown command: ${cmd}`);
  process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
