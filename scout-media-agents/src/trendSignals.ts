import path from "node:path";
import { PlannedCrawlTask, QueryScheduleState, SeedKeyword, TrendSignal } from "./types.js";
import { markTaskSuccess } from "./queryScheduleState.js";
import { addDays, clampNumber, nowIso, sha1, stableId, writeJson } from "./utils.js";

const EXPORT_COLUMNS = [
  "signal_id",
  "keyword_id",
  "crawl_task_id",
  "normalized_keyword",
  "topic_cluster",
  "trend_type",
  "signal_summary",
  "signal_evidence",
  "source_platform",
  "source_url",
  "trend_score",
  "confidence",
  "risk_flag",
  "observed_at",
  "fresh_until",
  "support_count",
  "evidence_ids",
  "aggregation_method",
  "version",
] as const;

function scoreSeed(task: PlannedCrawlTask): number {
  const raw = parseInt(sha1(task.queryUnitKey).slice(0, 8), 16);
  const base = (raw % 100) + 20;
  if (task.policy.platform === "wb") return clampNumber(base + 10, 0, 100);
  if (task.policy.platform === "dy") return clampNumber(base + 5, 0, 100);
  return clampNumber(base, 0, 100);
}

function confidenceForTask(task: PlannedCrawlTask): TrendSignal["confidence"] {
  if (task.policy.platform === "bili" || task.policy.platform === "wb") return "high";
  return task.policy.platform === "xhs" ? "medium" : "high";
}

function sourceUrl(task: PlannedCrawlTask): string {
  return `mediacrawler://${task.platform}/search?query=${encodeURIComponent(task.expandedQuery)}`;
}

export function synthesizeTrendSignals(tasks: PlannedCrawlTask[], at: Date): TrendSignal[] {
  return tasks.map((task) => ({
    signalId: stableId("sig", `${task.queryUnitKey}::${at.toISOString()}`),
    keywordId: task.keywordId,
    crawlTaskId: task.taskId,
    normalizedKeyword: task.normalizedKeyword,
    topicCluster: task.topicCluster,
    trendType: task.trendType,
    signalSummary: `${task.normalizedKeyword} 在 ${task.platform} 出现稳定讨论信号，当前主查询为“${task.expandedQuery}”。`,
    signalEvidence: `task=${task.taskId}; dedup=${task.dedupKey}; query=${task.expandedQuery}; platform=${task.platform}`,
    sourcePlatform: task.platform,
    sourceUrl: sourceUrl(task),
    trendScore: scoreSeed(task),
    confidence: confidenceForTask(task),
    riskFlag: task.policy.platform === "wb" ? "high" : "medium",
    observedAt: nowIso(at),
    freshUntil: nowIso(addDays(at, task.policy.platform === "xhs" ? 7 : 3)),
    supportCount: 1,
    evidenceIds: [task.taskId, task.queryStateId],
    aggregationMethod: "synthetic_backtest_v1",
    version: "trend_signal_v1",
  }));
}

export function applyTaskSuccess(states: QueryScheduleState[], tasks: PlannedCrawlTask[], at: Date): QueryScheduleState[] {
  const nextStates = [...states];
  for (const task of tasks) {
    const index = nextStates.findIndex((state) => state.id === task.queryStateId);
    if (index >= 0) nextStates[index] = markTaskSuccess(nextStates[index], at);
  }
  return nextStates;
}

function dedupeLatest(signals: TrendSignal[]): TrendSignal[] {
  const latest = new Map<string, TrendSignal>();
  for (const signal of signals) {
    const key = `${signal.normalizedKeyword.toLowerCase()}::${signal.sourcePlatform}`;
    const current = latest.get(key);
    if (!current || new Date(signal.observedAt).getTime() >= new Date(current.observedAt).getTime()) {
      latest.set(key, signal);
    }
  }
  return [...latest.values()].sort((a, b) => a.normalizedKeyword.localeCompare(b.normalizedKeyword) || a.sourcePlatform.localeCompare(b.sourcePlatform));
}

function toCsv(signals: TrendSignal[]): string {
  const lines = [EXPORT_COLUMNS.join(",")];
  for (const signal of signals) {
    const row: Record<string, string | number> = {
      signal_id: signal.signalId,
      keyword_id: signal.keywordId,
      crawl_task_id: signal.crawlTaskId,
      normalized_keyword: signal.normalizedKeyword,
      topic_cluster: signal.topicCluster,
      trend_type: signal.trendType,
      signal_summary: signal.signalSummary,
      signal_evidence: signal.signalEvidence,
      source_platform: signal.sourcePlatform,
      source_url: signal.sourceUrl,
      trend_score: signal.trendScore,
      confidence: signal.confidence,
      risk_flag: signal.riskFlag,
      observed_at: signal.observedAt,
      fresh_until: signal.freshUntil,
      support_count: signal.supportCount,
      evidence_ids: JSON.stringify(signal.evidenceIds),
      aggregation_method: signal.aggregationMethod,
      version: signal.version,
    };
    lines.push(EXPORT_COLUMNS.map((column) => `"${String(row[column]).replaceAll('"', '""')}"`).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export async function exportTrendSignals(stateDir: string, runId: string, signals: TrendSignal[]): Promise<{ currentJson: string; currentCsv: string; manifest: string }> {
  const deduped = dedupeLatest(signals);
  const handoffRoot = path.join(stateDir, "handoff", "trend_signal");
  const currentDir = path.join(handoffRoot, "current");
  const historyDir = path.join(handoffRoot, "history", runId);
  const payload = {
    run_id: runId,
    generated_at: new Date().toISOString(),
    count: deduped.length,
    results: deduped,
    source: "scout-media-agents-backtest",
  };
  const manifest = {
    run_id: runId,
    generated_at: new Date().toISOString(),
    exported_row_count: deduped.length,
    source: "scout-media-agents-backtest",
  };

  const currentJson = path.join(currentDir, "trend_signal_latest.json");
  const currentCsv = path.join(currentDir, "trend_signal_latest.csv");
  const currentManifest = path.join(currentDir, "manifest.json");
  const historyJson = path.join(historyDir, "trend_signal_latest.json");
  const historyCsv = path.join(historyDir, "trend_signal_latest.csv");
  const historyManifest = path.join(historyDir, "manifest.json");

  await writeJson(currentJson, payload);
  await writeJson(currentManifest, manifest);
  await writeJson(historyJson, payload);
  await writeJson(historyManifest, manifest);
  await writeJson(path.join(stateDir, "runtime", "latest-trend-signals.json"), deduped);
  await import("node:fs/promises").then((fs) => fs.writeFile(currentCsv, toCsv(deduped), "utf-8"));
  await import("node:fs/promises").then((fs) => fs.writeFile(historyCsv, toCsv(deduped), "utf-8"));

  return { currentJson, currentCsv, manifest: currentManifest };
}
