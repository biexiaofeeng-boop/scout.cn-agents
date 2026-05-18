import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ScoutPipeline } from "../pipeline.js";
import { loadOpsTopics, OPS_COLLECTABLE_PROVIDER_IDS, OPS_PROVIDERS, providersWithEnvState } from "./opsRegistry.js";
import { OpsReviewService } from "./opsReviewService.js";
import type { OpsActionInputRecord, OpsActionName, OpsActionRun, OpsActionRunStatus, OpsRunCleanupResult, OpsTopic } from "./types.js";

type OpsActionInput = {
  topicId?: unknown;
  providers?: unknown;
  query?: unknown;
  limit?: unknown;
  dryRun?: unknown;
  includeDryRun?: unknown;
  gameIds?: unknown;
  appId?: unknown;
  subreddit?: unknown;
};

type CommandResult = {
  label: string;
  command: string;
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  parsed?: unknown;
};

type PreparedRequest = {
  topic: OpsTopic;
  providers: string[];
  query: string;
  limit: number;
  dryRun: boolean;
  includeDryRun: boolean;
  gameIds: string[];
  appId: string;
  subreddit: string;
  inputRecord: OpsActionInputRecord;
};

const COLLECTABLE_PROVIDER_IDS = new Set<string>(OPS_COLLECTABLE_PROVIDER_IDS);
const MAX_LOG_TEXT = 16_000;

export class OpsActionService {
  private readonly reviewService: OpsReviewService;

  constructor(private readonly pipeline: ScoutPipeline) {
    this.reviewService = new OpsReviewService(pipeline.settings.runtimeRoot);
  }

  async run(action: OpsActionName, input: OpsActionInput): Promise<OpsActionRun> {
    const prepared = await this.prepareRequest(action, input);
    const startedAt = new Date().toISOString();
    const runId = buildOpsRunId(startedAt);
    const runDir = path.join(this.pipeline.settings.runtimeRoot, "runs", runId);
    const logPath = path.join(runDir, "logs.jsonl");
    const itemPath = path.join(runDir, "items.jsonl");
    const summaryPath = path.join(runDir, "summary.json");
    const reportPath = path.join(runDir, "report.md");
    await fs.mkdir(runDir, { recursive: true });

    const log = async (level: "info" | "warn" | "error", message: string, data: Record<string, unknown> = {}) => {
      await appendJsonl(logPath, {
        timestamp: new Date().toISOString(),
        level,
        message: redactSecrets(message),
        data: redactSecretsInObject(data),
      });
    };

    const item = async (result: CommandResult) => {
      await appendJsonl(itemPath, {
        timestamp: new Date().toISOString(),
        label: result.label,
        command: result.command,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        parsed: result.parsed,
      });
    };

    await log("info", `Starting ${action}`, {
      runId,
      topicId: prepared.topic.id,
      providers: prepared.providers,
      dryRun: prepared.dryRun,
    });

    const commandResults: CommandResult[] = [];
    let errorText = "";

    try {
      if (action === "collect-topic" || action === "collect-and-normalize-topic") {
        for (const provider of prepared.providers) {
          const result = await this.runCollectCommand(prepared, provider, log);
          commandResults.push(result);
          await item(result);
        }
      }

      if (action === "normalize-topic" || action === "collect-and-normalize-topic") {
        const result = await this.runNormalizeCommand(prepared, log);
        commandResults.push(result);
        await item(result);
      }
    } catch (err) {
      errorText = publicError(err);
      await log("error", errorText);
    }

    const failedCommandCount = commandResults.filter((result) => result.exitCode !== 0).length + (errorText ? 1 : 0);
    const successfulCommandCount = commandResults.filter((result) => result.exitCode === 0).length;
    const status = statusFromCounts(commandResults.length, failedCommandCount);
    const endedAt = new Date().toISOString();
    const normalized = latestNormalizeParsed(commandResults);
    const summary: OpsActionRun = {
      runId,
      action,
      status,
      topicId: prepared.topic.id,
      vertical: prepared.topic.vertical,
      providers: prepared.providers,
      dryRun: prepared.dryRun,
      startedAt,
      endedAt,
      runDir,
      reportPath,
      rawRecordCount: Number(normalized?.rawRecordCount || collectedRecordCount(commandResults)),
      normalizedEvidenceCount: Number(normalized?.evidenceCount || 0),
      errorText: errorText || firstCommandError(commandResults),
      query: prepared.query,
      limit: prepared.limit,
      input: prepared.inputRecord,
      commandCount: commandResults.length,
      successfulCommandCount,
      failedCommandCount,
      itemPath,
      logPath,
      summaryPath,
    };

    await writeJson(path.join(runDir, "run.json"), {
      ...summary,
      commandResults,
    });
    await writeJson(summaryPath, summary);
    await fs.writeFile(reportPath, buildRunReport(summary, commandResults), "utf-8");
    await this.reviewService.createFromRun(summary, normalized);
    await this.cleanupRuns();
    await log(status === "success" ? "info" : "warn", `Finished ${action} with status=${status}`, { runId, status });
    return summary;
  }

  async retry(runId: string): Promise<OpsActionRun> {
    const run = await this.readRun(runId);
    if (!run) throw new Error("Run not found.");
    const action = stringValue(run.action) as OpsActionName;
    if (!["collect-topic", "normalize-topic", "collect-and-normalize-topic"].includes(action)) {
      throw new Error("Run action cannot be retried.");
    }
    const input = run.input && typeof run.input === "object"
      ? run.input as OpsActionInputRecord
      : fallbackInputFromRun(run);
    return this.run(action, input);
  }

  async cleanupRuns(): Promise<OpsRunCleanupResult> {
    const runsDir = path.join(this.pipeline.settings.runtimeRoot, "runs");
    const retentionDays = this.pipeline.settings.opsRunRetentionDays;
    const retentionMax = this.pipeline.settings.opsRunRetentionMax;
    let entries: Array<{ runId: string; runDir: string; startedAt: string; mtimeMs: number }> = [];
    try {
      const dirents = await fs.readdir(runsDir, { withFileTypes: true });
      entries = await Promise.all(dirents
        .filter((entry) => entry.isDirectory() && entry.name.startsWith("scout_run_"))
        .map(async (entry) => {
          const runDir = path.join(runsDir, entry.name);
          const stat = await fs.stat(runDir);
          const summary = await readJson(path.join(runDir, "summary.json"));
          return {
            runId: entry.name,
            runDir,
            startedAt: stringValue(summary?.startedAt),
            mtimeMs: stat.mtimeMs,
          };
        }));
    } catch {
      return { runsDir, retentionDays, retentionMax, deletedCount: 0, keptCount: 0, deletedRunIds: [] };
    }

    const now = Date.now();
    const cutoffMs = retentionDays > 0 ? now - retentionDays * 24 * 60 * 60 * 1000 : 0;
    const sorted = entries.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const keepByMax = new Set(sorted.slice(0, Math.max(1, retentionMax)).map((entry) => entry.runId));
    const toDelete = sorted.filter((entry) => {
      const olderThanCutoff = retentionDays > 0 && entry.mtimeMs < cutoffMs;
      const overMax = retentionMax > 0 && !keepByMax.has(entry.runId);
      return olderThanCutoff || overMax;
    });

    for (const entry of toDelete) {
      await fs.rm(entry.runDir, { recursive: true, force: true });
    }

    return {
      runsDir,
      retentionDays,
      retentionMax,
      deletedCount: toDelete.length,
      keptCount: sorted.length - toDelete.length,
      deletedRunIds: toDelete.map((entry) => entry.runId),
    };
  }

  async readRun(runId: string): Promise<Record<string, unknown> | undefined> {
    const safeRunId = sanitizeRunId(runId);
    if (!safeRunId) return undefined;
    return readJson(path.join(this.pipeline.settings.runtimeRoot, "runs", safeRunId, "run.json"));
  }

  async readRunLogs(runId: string): Promise<Array<Record<string, unknown>>> {
    const safeRunId = sanitizeRunId(runId);
    if (!safeRunId) return [];
    return readJsonl(path.join(this.pipeline.settings.runtimeRoot, "runs", safeRunId, "logs.jsonl"));
  }

  private async prepareRequest(action: OpsActionName, input: OpsActionInput): Promise<PreparedRequest> {
    const topicConfigPath = path.join(this.pipeline.settings.projectRoot, "scout-media-agents", "config", "topics", "scout-topics.json");
    const topics = await loadOpsTopics(topicConfigPath);
    const topicId = stringValue(input.topicId);
    const topic = topics.find((candidate) => candidate.id === topicId);
    if (!topic) throw new Error("Unknown topicId. Use a topic from scout-media-agents/config/topics/scout-topics.json.");

    const providerIds = providerList(input.providers);
    if ((action === "collect-topic" || action === "collect-and-normalize-topic") && providerIds.length === 0) {
      throw new Error("At least one provider is required for collection.");
    }
    if (action === "normalize-topic" && providerIds.length === 0) {
      providerIds.push(...topic.dataSources.filter((provider) => COLLECTABLE_PROVIDER_IDS.has(provider)));
    }

    const providers = [...new Set(providerIds)];
    const providerState = providersWithEnvState();
    for (const providerId of providers) {
      const provider = OPS_PROVIDERS.find((candidate) => candidate.id === providerId);
      if (!provider) throw new Error(`Unknown provider: ${providerId}`);
      if (!COLLECTABLE_PROVIDER_IDS.has(providerId)) throw new Error(`Provider is not enabled for SO2 actions: ${providerId}`);
      if (!topic.dataSources.includes(providerId)) throw new Error(`Provider ${providerId} is not configured for topic ${topic.id}`);
      const ready = providerState.find((candidate) => candidate.id === providerId);
      if (ready?.envState === "missing" && !boolValue(input.dryRun)) {
        throw new Error(`Provider ${providerId} is missing required environment configuration.`);
      }
    }

    const query = stringValue(input.query) || topic.name;
    const limit = boundedInt(input.limit, 10, 1, 25);
    const dryRun = boolValue(input.dryRun);
    const includeDryRun = boolValue(input.includeDryRun);
    const gameIds = stringList(input.gameIds);
    const appId = stringValue(input.appId);
    const subreddit = stringValue(input.subreddit);

    return {
      topic,
      providers,
      query,
      limit,
      dryRun,
      includeDryRun,
      gameIds,
      appId,
      subreddit,
      inputRecord: {
        topicId: topic.id,
        providers,
        query,
        limit,
        dryRun,
        includeDryRun,
        gameIds,
        appId,
        subreddit,
      },
    };
  }

  private async runCollectCommand(
    prepared: PreparedRequest,
    provider: string,
    log: (level: "info" | "warn" | "error", message: string, data?: Record<string, unknown>) => Promise<void>,
  ): Promise<CommandResult> {
    const args = [
      path.join(this.pipeline.settings.vendorRoot, "src", "cli.ts"),
      "collect",
      "--provider",
      provider,
      "--topic-id",
      prepared.topic.id,
      "--vertical",
      prepared.topic.vertical,
      "--query",
      prepared.query,
      "--market",
      prepared.topic.market || "US",
      "--language",
      prepared.topic.language || "en-US",
      "--limit",
      String(prepared.limit),
      "--runtime-root",
      this.pipeline.settings.runtimeRoot,
    ];
    if (prepared.dryRun) args.push("--dry-run");
    if (provider === "steam" && prepared.appId) args.push("--app-id", prepared.appId);
    if (provider === "reddit" && prepared.subreddit) args.push("--subreddit", prepared.subreddit);
    await log("info", `Collecting provider=${provider}`, { provider });
    return this.runVendorCommand(`collect:${provider}`, args);
  }

  private async runNormalizeCommand(
    prepared: PreparedRequest,
    log: (level: "info" | "warn" | "error", message: string, data?: Record<string, unknown>) => Promise<void>,
  ): Promise<CommandResult> {
    const args = [
      path.join(this.pipeline.settings.vendorRoot, "src", "cli.ts"),
      "normalize",
      "--topic-id",
      prepared.topic.id,
      "--vertical",
      prepared.topic.vertical,
      "--runtime-root",
      this.pipeline.settings.runtimeRoot,
    ];
    if (prepared.providers.length) args.push("--providers", prepared.providers.join(","));
    if (prepared.gameIds.length) args.push("--game-ids", prepared.gameIds.join(","));
    if (prepared.includeDryRun) args.push("--include-dry-run");
    await log("info", "Normalizing topic evidence", { providers: prepared.providers });
    return this.runVendorCommand("normalize", args);
  }

  private runVendorCommand(label: string, args: string[]): Promise<CommandResult> {
    return new Promise((resolve) => {
      const tsxBin = path.join(process.cwd(), "node_modules", ".bin", "tsx");
      const child = spawn(tsxBin, args, {
        cwd: this.pipeline.settings.projectRoot,
        env: process.env,
        shell: false,
        windowsHide: true,
      });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, this.pipeline.settings.opsActionTimeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        stdout = appendBounded(stdout, chunk.toString("utf-8"));
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr = appendBounded(stderr, chunk.toString("utf-8"));
      });
      child.on("close", (exitCode) => {
        clearTimeout(timer);
        const cleanStdout = redactSecrets(stdout.trim());
        const cleanStderr = redactSecrets(stderr.trim());
        resolve({
          label,
          command: `${shellDisplayArg(tsxBin)} ${args.map(shellDisplayArg).join(" ")}`,
          exitCode,
          timedOut,
          stdout: cleanStdout,
          stderr: cleanStderr,
          parsed: parseJsonOutput(cleanStdout),
        });
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        resolve({
          label,
          command: `${shellDisplayArg(tsxBin)} ${args.map(shellDisplayArg).join(" ")}`,
          exitCode: 1,
          timedOut,
          stdout: "",
          stderr: publicError(err),
        });
      });
    });
  }
}

function buildOpsRunId(startedAt: string): string {
  return `scout_run_${startedAt.replaceAll(/[:.]/g, "-")}_${randomUUID().slice(0, 8)}`;
}

function sanitizeRunId(runId: string): string {
  return /^scout_run_[a-zA-Z0-9_.:-]+$/.test(runId) ? runId : "";
}

function statusFromCounts(commandCount: number, failedCommandCount: number): OpsActionRunStatus {
  if (failedCommandCount === 0) return "success";
  if (commandCount > failedCommandCount) return "partial_failed";
  return "failed";
}

function firstCommandError(results: CommandResult[]): string | undefined {
  const failed = results.find((result) => result.exitCode !== 0);
  if (!failed) return undefined;
  return failed.stderr || `${failed.label} failed with exitCode=${failed.exitCode}`;
}

function collectedRecordCount(results: CommandResult[]): number {
  return results.reduce((sum, result) => {
    const parsed = result.parsed as { recordCount?: unknown } | undefined;
    return sum + Number(parsed?.recordCount || 0);
  }, 0);
}

function fallbackInputFromRun(run: Record<string, unknown>): OpsActionInputRecord {
  return {
    topicId: stringValue(run.topicId),
    providers: stringList(run.providers),
    query: stringValue(run.query),
    limit: boundedInt(run.limit, 10, 1, 25),
    dryRun: boolValue(run.dryRun),
    includeDryRun: boolValue(run.includeDryRun),
    gameIds: stringList(run.gameIds),
    appId: stringValue(run.appId),
    subreddit: stringValue(run.subreddit),
  };
}

function latestNormalizeParsed(results: CommandResult[]): Record<string, unknown> | undefined {
  const normalized = [...results].reverse().find((result) => result.label === "normalize" && result.parsed);
  return normalized?.parsed as Record<string, unknown> | undefined;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function boolValue(value: unknown): boolean {
  return value === true || value === "true" || value === "1" || value === "on";
}

function boundedInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function providerList(value: unknown): string[] {
  return stringList(value).map((provider) => provider.trim()).filter(Boolean);
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function parseJsonOutput(stdout: string): unknown {
  if (!stdout) return undefined;
  try {
    return JSON.parse(stdout);
  } catch {
    return undefined;
  }
}

function appendBounded(current: string, next: string): string {
  const combined = current + next;
  return combined.length > MAX_LOG_TEXT ? combined.slice(combined.length - MAX_LOG_TEXT) : combined;
}

function shellDisplayArg(value: string): string {
  return /^[a-zA-Z0-9_./:=,-]+$/.test(value) ? value : JSON.stringify(value);
}

function publicError(err: unknown): string {
  return redactSecrets(err instanceof Error ? err.message : String(err));
}

function redactSecrets(value: string): string {
  let result = value;
  for (const [key, secret] of Object.entries(process.env)) {
    if (!secret || secret.length < 6) continue;
    if (!/(KEY|TOKEN|SECRET|PASS|PWD)/i.test(key)) continue;
    result = result.replaceAll(secret, `[redacted:${key}]`);
  }
  return result;
}

function redactSecretsInObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(redactSecrets(JSON.stringify(value))) as Record<string, unknown>;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf-8");
}

async function appendJsonl(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, JSON.stringify(value) + "\n", "utf-8");
}

async function readJson(filePath: string): Promise<Record<string, unknown> | undefined> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

async function readJsonl(filePath: string): Promise<Array<Record<string, unknown>>> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return raw.split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line) as Record<string, unknown>);
  } catch {
    return [];
  }
}

function buildRunReport(summary: OpsActionRun, results: CommandResult[]): string {
  return [
    `# Scout Ops Run ${summary.runId}`,
    "",
    `- action: ${summary.action}`,
    `- status: ${summary.status}`,
    `- topic: ${summary.topicId}`,
    `- providers: ${summary.providers.join(", ") || "n/a"}`,
    `- dryRun: ${summary.dryRun}`,
    `- startedAt: ${summary.startedAt}`,
    `- endedAt: ${summary.endedAt}`,
    `- rawRecordCount: ${summary.rawRecordCount}`,
    `- normalizedEvidenceCount: ${summary.normalizedEvidenceCount}`,
    summary.errorText ? `- errorText: ${summary.errorText}` : "",
    "",
    "## Commands",
    "",
    ...results.map((result) => [
      `### ${result.label}`,
      "",
      `- exitCode: ${result.exitCode}`,
      `- timedOut: ${result.timedOut}`,
      result.stderr ? `- stderr: ${result.stderr.replace(/\n/g, " ").slice(0, 500)}` : "",
      "",
    ].join("\n")),
  ].filter(Boolean).join("\n") + "\n";
}
