import "dotenv/config";
import path from "node:path";
import { runBacktest } from "./backtest.js";

type CommandOptions = Record<string, string | boolean>;

function parseArgs(argv: string[]): { command: string; options: CommandOptions } {
  const command = argv[2] || "backtest";
  const options: CommandOptions = {};
  for (let index = 3; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return { command, options };
}

function projectRoot(): string {
  return path.resolve(path.join(process.cwd()));
}

async function run(): Promise<void> {
  const { command, options } = parseArgs(process.argv);
  if (command === "backtest") {
    const report = await runBacktest({
      projectRoot: projectRoot(),
      seedFile: typeof options["seed-file"] === "string" ? String(options["seed-file"]) : undefined,
      stateDir: typeof options["state-dir"] === "string" ? String(options["state-dir"]) : undefined,
      runtimeProfile: typeof options.profile === "string" ? (String(options.profile) as "safe_live" | "debug_fast") : undefined,
    });
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (command === "help") {
    console.log([
      "scout-media-agents commands:",
      "  backtest [--seed-file <path>] [--state-dir <path>] [--profile safe_live|debug_fast]",
    ].join("\n"));
    return;
  }

  throw new Error(`Unsupported command: ${command}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
