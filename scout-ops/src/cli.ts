import { loadSettings } from "./config.js";
import { runInboxPreview, runInboxStatus, runInboxSync } from "./inbox/inboxCli.js";
import { ScoutPipeline } from "./pipeline.js";
import { startMonitorApi } from "./server.js";
import { runScheduler } from "./scheduler.js";

function arg(name: string, defaultValue?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return defaultValue;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
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

  if (cmd === "inbox") {
    const sub = process.argv[3] || "status";
    const log = (line: string) => console.log(line);
    if (sub === "status" || sub === "list") {
      process.exit(await runInboxStatus(settings, log));
    }
    if (sub === "preview") {
      const target = process.argv[4];
      if (!target) { console.error("usage: cli inbox preview <pack-relative-path>"); process.exit(2); }
      process.exit(await runInboxPreview(settings, target, log));
    }
    if (sub === "sync") {
      const target = process.argv[4];
      if (!target) { console.error("usage: cli inbox sync <pack-relative-path> [--dry-run]"); process.exit(2); }
      process.exit(await runInboxSync(settings, target, log, { dryRun: hasFlag("--dry-run") }));
    }
    console.error(`unknown inbox sub-command: ${sub}. use: status | preview | sync`);
    process.exit(2);
  }

  console.error(`unknown command: ${cmd}`);
  process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
