import { collect } from "./collector.js";
import { DATA_PROVIDERS } from "./providers.js";
import type { CollectionRequest } from "./types.js";
import { defaultRuntimeRoot } from "./utils.js";

type Options = Record<string, string | boolean>;

function parseArgs(argv: string[]): { command: string; options: Options } {
  const command = argv[2] || "help";
  const options: Options = {};
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

function stringOption(options: Options, key: string, fallback = ""): string {
  const value = options[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberOption(options: Options, key: string, fallback: number): number {
  const parsed = Number(stringOption(options, key));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function requestFromOptions(options: Options): CollectionRequest {
  const provider = stringOption(options, "provider");
  const topicId = stringOption(options, "topic-id");
  const query = stringOption(options, "query");
  if (!provider) throw new Error("--provider is required");
  if (!topicId) throw new Error("--topic-id is required");
  if (!query) throw new Error("--query is required");
  const appId = stringOption(options, "app-id");
  const subreddit = stringOption(options, "subreddit");
  return {
    provider,
    topicId,
    vertical: stringOption(options, "vertical", "game"),
    query,
    market: stringOption(options, "market", "US"),
    language: stringOption(options, "language", "en-US"),
    limit: numberOption(options, "limit", 10),
    dryRun: options["dry-run"] === true,
    ...(appId ? { appId } : {}),
    ...(subreddit ? { subreddit } : {}),
  };
}

async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv);
  if (command === "providers:list") {
    console.log(JSON.stringify({ providers: DATA_PROVIDERS }, null, 2));
    return;
  }
  if (command === "collect") {
    const runtimeRoot = stringOption(options, "runtime-root", defaultRuntimeRoot());
    const result = await collect(requestFromOptions(options), runtimeRoot);
    console.log(JSON.stringify({
      runId: result.runId,
      recordCount: result.records.length,
      outputPath: result.outputPath,
      manifestPath: result.manifestPath,
    }, null, 2));
    return;
  }
  if (command === "help") {
    console.log([
      "scout-vendor commands:",
      "  providers:list",
      "  collect --provider steam|youtube|reddit --topic-id <id> --query <q> [--vertical game] [--market US] [--language en-US] [--limit 10]",
      "  collect --provider steam --topic-id <id> --query <q> --app-id <steam_app_id>",
      "  collect --provider reddit --topic-id <id> --query <q> [--subreddit <name>]",
      "  collect ... [--runtime-root /Users/sourcefire/1data/scout] [--dry-run]",
    ].join("\n"));
    return;
  }
  throw new Error(`Unsupported command: ${command}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
