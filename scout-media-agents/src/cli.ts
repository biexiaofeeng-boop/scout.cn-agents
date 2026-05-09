import "dotenv/config";
import path from "node:path";
import { runBacktest } from "./backtest.js";
import {
  approveReviewEntry,
  listReviewEntries,
  listRuns,
  listTopicSummaries,
  loadGovernanceContext,
  planNextTasks,
} from "./governanceRegistry.js";
import { ReviewStatus, RuntimeProfileName } from "./types.js";

type CommandOptions = Record<string, string | boolean>;

type ParsedArgs = {
  command: string;
  options: CommandOptions;
  positionals: string[];
};

function parseArgs(argv: string[]): ParsedArgs {
  const command = argv[2] || "help";
  const options: CommandOptions = {};
  const positionals: string[] = [];

  for (let index = 3; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const trimmed = token.slice(2);
    if (trimmed.includes("=")) {
      const [key, ...rest] = trimmed.split("=");
      options[key] = rest.join("=") || true;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      options[trimmed] = true;
      continue;
    }

    options[trimmed] = next;
    index += 1;
  }

  return { command, options, positionals };
}

function projectRoot(): string {
  return path.resolve(process.cwd());
}

function stringOption(options: CommandOptions, key: string): string | undefined {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}

function numberOption(options: CommandOptions, key: string): number | undefined {
  const value = stringOption(options, key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function runtimeProfileFromOptions(options: CommandOptions): RuntimeProfileName {
  const value = stringOption(options, "profile");
  return value === "debug_fast" ? "debug_fast" : "safe_live";
}

function reviewStatusFromOptions(options: CommandOptions): ReviewStatus | undefined {
  const value = stringOption(options, "status");
  if (value === "approved" || value === "pending" || value === "rejected") {
    return value;
  }
  return undefined;
}

async function run(): Promise<void> {
  const { command, options, positionals } = parseArgs(process.argv);

  if (command === "backtest") {
    const report = await runBacktest({
      projectRoot: projectRoot(),
      seedFile: stringOption(options, "seed-file"),
      stateDir: stringOption(options, "state-dir"),
      runtimeProfile: runtimeProfileFromOptions(options),
      skipLlm: options["skip-llm"] === true,
    });
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (command === "topics:list") {
    const context = await loadGovernanceContext({
      projectRoot: projectRoot(),
      seedFile: stringOption(options, "seed-file"),
      stateDir: stringOption(options, "state-dir"),
    });
    console.log(JSON.stringify({ loadedAt: context.loadedAt, items: listTopicSummaries(context) }, null, 2));
    return;
  }

  if (command === "review:list") {
    const context = await loadGovernanceContext({
      projectRoot: projectRoot(),
      seedFile: stringOption(options, "seed-file"),
      stateDir: stringOption(options, "state-dir"),
    });
    const status = reviewStatusFromOptions(options);
    console.log(JSON.stringify({ loadedAt: context.loadedAt, items: listReviewEntries(context, status) }, null, 2));
    return;
  }

  if (command === "review:approve") {
    const expansionId = positionals[0] || stringOption(options, "id");
    if (!expansionId) {
      throw new Error("review:approve requires an expansion id as positional arg or --id");
    }
    const context = await loadGovernanceContext({
      projectRoot: projectRoot(),
      seedFile: stringOption(options, "seed-file"),
      stateDir: stringOption(options, "state-dir"),
    });
    const decision = await approveReviewEntry(context, expansionId, stringOption(options, "actor") || "operator", stringOption(options, "note"));
    const refreshed = await loadGovernanceContext({
      projectRoot: projectRoot(),
      seedFile: stringOption(options, "seed-file"),
      stateDir: stringOption(options, "state-dir"),
    });
    console.log(
      JSON.stringify(
        {
          decision,
          entry: listReviewEntries(refreshed).find((item) => item.id === expansionId),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (command === "plan:next") {
    const context = await loadGovernanceContext({
      projectRoot: projectRoot(),
      seedFile: stringOption(options, "seed-file"),
      stateDir: stringOption(options, "state-dir"),
    });
    const plan = planNextTasks(context, runtimeProfileFromOptions(options), numberOption(options, "limit"));
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  if (command === "runs:list") {
    const context = await loadGovernanceContext({
      projectRoot: projectRoot(),
      seedFile: stringOption(options, "seed-file"),
      stateDir: stringOption(options, "state-dir"),
    });
    console.log(JSON.stringify(await listRuns(context, numberOption(options, "limit")), null, 2));
    return;
  }

  if (command === "help") {
    console.log(
      [
        "scout-media-agents commands:",
        "  help",
        "  backtest [--seed-file <path>] [--state-dir <path>] [--profile safe_live|debug_fast] [--skip-llm]",
        "  topics:list [--seed-file <path>] [--state-dir <path>]",
        "  review:list [--status approved|pending|rejected] [--seed-file <path>] [--state-dir <path>]",
        "  review:approve <expansion-id> [--actor <name>] [--note <text>] [--seed-file <path>] [--state-dir <path>]",
        "  plan:next [--limit <n>] [--profile safe_live|debug_fast] [--seed-file <path>] [--state-dir <path>]",
        "  runs:list [--limit <n>] [--state-dir <path>]",
      ].join("\n"),
    );
    return;
  }

  throw new Error(`Unsupported command: ${command}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
