import fs from "node:fs/promises";
import path from "node:path";
import type { VendorEvidenceRecord } from "./types.js";
import { defaultRuntimeRoot, nowIso, sanitizePathToken, stableId, writeJson, writeJsonl } from "./utils.js";

export type GameLensEvidenceSource =
  | "manual"
  | "csv"
  | "steam_review"
  | "youtube"
  | "reddit"
  | "tiktok_ad"
  | "meta_ad"
  | "google_ad"
  | "app_store_review"
  | "google_play_review"
  | "weibo"
  | "bilibili"
  | "douyin"
  | "xiaohongshu"
  | "zhihu"
  | "tieba"
  | "kuaishou";

export type GameLensEvidenceItem = {
  id: string;
  source: GameLensEvidenceSource;
  sourceUrl?: string;
  sourceItemId?: string;
  title: string;
  text: string;
  mediaUrl?: string;
  author?: string;
  publishedAt?: string;
  collectedAt: string;
  market: string;
  language: string;
  metrics: Record<string, string | number | boolean>;
  rawPayload: Record<string, unknown>;
  gameIds: string[];
};

export type NormalizeOptions = {
  topicId: string;
  vertical?: string;
  runtimeRoot?: string;
  providers?: string[];
  gameIds?: string[];
  includeDryRun?: boolean;
};

export type ProviderSummary = {
  provider: string;
  rawRecords: number;
  normalizedRecords: number;
  skippedDryRun: number;
  duplicateRecords: number;
  parseErrors: number;
  inputFiles: string[];
};

export type NormalizeResult = {
  schema: "scout_vendor_normalize_result_v1";
  generatedAt: string;
  topicId: string;
  vertical: string;
  runtimeRoot: string;
  topicDir: string;
  evidenceCount: number;
  rawRecordCount: number;
  skippedDryRunCount: number;
  duplicateCount: number;
  parseErrorCount: number;
  providers: ProviderSummary[];
  normalizedPath: string;
  normalizedManifestPath: string;
  gameLensHandoffPath: string;
  reportPath: string;
  samples: GameLensEvidenceItem[];
};

type ReadRecord = {
  filePath: string;
  lineNumber: number;
  record?: VendorEvidenceRecord;
  error?: string;
};

export async function normalizeTopic(options: NormalizeOptions): Promise<NormalizeResult> {
  if (!options.topicId.trim()) throw new Error("topicId is required");

  const runtimeRoot = options.runtimeRoot || defaultRuntimeRoot();
  const vertical = options.vertical || "game";
  const topicId = options.topicId;
  const topicDir = path.join(runtimeRoot, "topics", sanitizePathToken(vertical), sanitizePathToken(topicId));
  const rawDir = path.join(topicDir, "raw");
  const normalizedDir = path.join(topicDir, "normalized");
  const gameLensDir = path.join(topicDir, "handoff", "gamelens");
  const reportsDir = path.join(topicDir, "reports");
  const providerFilter = new Set((options.providers || []).map((provider) => sanitizePathToken(provider)).filter(Boolean));

  const files = await listJsonlFiles(rawDir, providerFilter);
  const readRecords = await readVendorRecords(files);
  const summaries = new Map<string, ProviderSummary>();
  const evidence: GameLensEvidenceItem[] = [];
  const seen = new Set<string>();
  let skippedDryRunCount = 0;
  let duplicateCount = 0;
  let rawRecordCount = 0;
  let parseErrorCount = 0;

  for (const readRecord of readRecords) {
    const providerFromPath = providerFromRawPath(rawDir, readRecord.filePath);
    const summary = ensureProviderSummary(summaries, providerFromPath || "unknown");
    summary.inputFiles.push(readRecord.filePath);

    if (readRecord.error || !readRecord.record) {
      summary.parseErrors += 1;
      parseErrorCount += 1;
      continue;
    }

    const record = readRecord.record;
    const provider = sanitizePathToken(record.provider || providerFromPath || "unknown");
    const providerSummary = ensureProviderSummary(summaries, provider);
    providerSummary.inputFiles.push(readRecord.filePath);
    providerSummary.rawRecords += 1;
    rawRecordCount += 1;

    if (record.source === "dry_run" && !options.includeDryRun) {
      providerSummary.skippedDryRun += 1;
      skippedDryRunCount += 1;
      continue;
    }

    const item = vendorRecordToGameLensEvidence(record, evidence.length, options.gameIds || []);
    const dedupeKey = `${item.source}:${item.sourceItemId || item.sourceUrl || item.id}`;
    if (seen.has(dedupeKey)) {
      providerSummary.duplicateRecords += 1;
      duplicateCount += 1;
      continue;
    }

    seen.add(dedupeKey);
    providerSummary.normalizedRecords += 1;
    evidence.push(item);
  }

  const generatedAt = nowIso();
  const normalizedPath = path.join(normalizedDir, "evidence.jsonl");
  const normalizedManifestPath = path.join(normalizedDir, "evidence.manifest.json");
  const gameLensHandoffPath = path.join(gameLensDir, "evidence.json");
  const reportPath = path.join(reportsDir, "latest.md");
  const providers = [...summaries.values()].map((summary) => ({
    ...summary,
    inputFiles: [...new Set(summary.inputFiles)].sort(),
  })).sort((a, b) => a.provider.localeCompare(b.provider));

  const result: NormalizeResult = {
    schema: "scout_vendor_normalize_result_v1",
    generatedAt,
    topicId,
    vertical,
    runtimeRoot,
    topicDir,
    evidenceCount: evidence.length,
    rawRecordCount,
    skippedDryRunCount,
    duplicateCount,
    parseErrorCount,
    providers,
    normalizedPath,
    normalizedManifestPath,
    gameLensHandoffPath,
    reportPath,
    samples: evidence.slice(0, 5),
  };

  await writeJsonl(normalizedPath, evidence);
  await writeJson(normalizedManifestPath, {
    ...result,
    samples: result.samples.map((sample) => sample.id),
  });
  await writeJson(gameLensHandoffPath, {
    schema: "gamelens_evidence_handoff_v1",
    generatedAt,
    topicId,
    vertical,
    evidenceCount: evidence.length,
    evidence,
    provenance: {
      runtimeRoot,
      normalizedPath,
      normalizedManifestPath,
      providers,
    },
  });
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.writeFile(reportPath, buildTopicReport(result, evidence), "utf-8");

  return result;
}

export function vendorRecordToGameLensEvidence(record: VendorEvidenceRecord, index = 0, gameIds: string[] = []): GameLensEvidenceItem {
  const source = mapEvidenceSource(record);
  const sourceItemId = record.id || stableId("source", JSON.stringify(record), index);
  const title = safeText(record.title, `Evidence ${index + 1}`);
  const text = safeText(record.text, title);
  const metrics = sanitizeMetrics({
    ...record.metrics,
    scoutProvider: record.provider,
    scoutSource: record.source,
    scoutTopicId: record.topicId,
    scoutVertical: record.vertical,
    scoutQuery: record.query,
  });
  const mediaUrl = extractMediaUrl(record);

  return stripUndefined({
    id: stableId("ev_gamelens", `${record.provider}:${sourceItemId}`, index),
    source,
    sourceUrl: record.url,
    sourceItemId,
    title,
    text,
    mediaUrl,
    author: record.author,
    publishedAt: record.publishedAt,
    collectedAt: record.collectedAt || nowIso(),
    market: record.market || "US",
    language: record.language || "en-US",
    metrics,
    rawPayload: {
      scoutVendorRecord: record,
    },
    gameIds,
  });
}

function mapEvidenceSource(record: VendorEvidenceRecord): GameLensEvidenceSource {
  if (record.provider === "reddit") return "reddit";
  if (record.provider === "youtube") return "youtube";
  if (record.provider === "steam" && record.source === "steam_review") return "steam_review";
  if (record.provider === "mediacrawler") {
    // record.source looks like "mediacrawler_<platform>"; pull the platform half
    const platform = record.source.replace(/^mediacrawler_/, "");
    const allowed: GameLensEvidenceSource[] = ["weibo", "bilibili", "douyin", "xiaohongshu", "zhihu", "tieba", "kuaishou"];
    if ((allowed as string[]).includes(platform)) return platform as GameLensEvidenceSource;
  }
  return "manual";
}

function safeText(value: string | undefined, fallback: string): string {
  const normalized = (value || "").replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

function sanitizeMetrics(input: Record<string, unknown>): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      result[key] = value;
    }
  }
  return result;
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) delete value[key];
  }
  return value;
}

function extractMediaUrl(record: VendorEvidenceRecord): string | undefined {
  const item = record.rawPayload?.item;
  if (item && typeof item === "object" && "tiny_image" in item) {
    const tinyImage = (item as { tiny_image?: unknown }).tiny_image;
    if (typeof tinyImage === "string" && tinyImage.trim()) return tinyImage;
  }
  return undefined;
}

async function listJsonlFiles(rawDir: string, providers: Set<string>): Promise<string[]> {
  try {
    const stat = await fs.stat(rawDir);
    if (!stat.isDirectory()) return [];
  } catch {
    return [];
  }

  const result: string[] = [];
  const providerDirs = await fs.readdir(rawDir, { withFileTypes: true });
  for (const entry of providerDirs) {
    if (!entry.isDirectory()) continue;
    const provider = sanitizePathToken(entry.name);
    if (providers.size > 0 && !providers.has(provider)) continue;
    const providerDir = path.join(rawDir, entry.name);
    const files = await listFiles(providerDir);
    result.push(...files.filter((file) => file.endsWith(".jsonl")));
  }
  return result.sort();
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(fullPath));
    if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

async function readVendorRecords(files: string[]): Promise<ReadRecord[]> {
  const records: ReadRecord[] = [];
  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]?.trim();
      if (!line) continue;
      try {
        records.push({ filePath, lineNumber: index + 1, record: JSON.parse(line) as VendorEvidenceRecord });
      } catch (error) {
        records.push({ filePath, lineNumber: index + 1, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  return records;
}

function providerFromRawPath(rawDir: string, filePath: string): string | undefined {
  const relative = path.relative(rawDir, filePath);
  const [provider] = relative.split(path.sep);
  return provider ? sanitizePathToken(provider) : undefined;
}

function ensureProviderSummary(summaries: Map<string, ProviderSummary>, provider: string): ProviderSummary {
  const key = sanitizePathToken(provider);
  const existing = summaries.get(key);
  if (existing) return existing;
  const summary: ProviderSummary = {
    provider: key,
    rawRecords: 0,
    normalizedRecords: 0,
    skippedDryRun: 0,
    duplicateRecords: 0,
    parseErrors: 0,
    inputFiles: [],
  };
  summaries.set(key, summary);
  return summary;
}

function buildTopicReport(result: NormalizeResult, evidence: GameLensEvidenceItem[]): string {
  const providerRows = result.providers.length > 0
    ? result.providers.map((provider) => `| ${provider.provider} | ${provider.rawRecords} | ${provider.normalizedRecords} | ${provider.skippedDryRun} | ${provider.duplicateRecords} | ${provider.parseErrors} |`).join("\n")
    : "| none | 0 | 0 | 0 | 0 | 0 |";
  const queryRows = buildQueryRows(evidence);
  const sampleSections = evidence.slice(0, 5).map((item, index) => [
    `### Sample ${index + 1}: ${escapeMarkdown(item.title)}`,
    "",
    `- id: \`${item.id}\``,
    `- source: \`${item.source}\``,
    `- provider: \`${String(item.metrics.scoutProvider || "unknown")}\``,
    `- query: ${escapeMarkdown(String(item.metrics.scoutQuery || "unknown"))}`,
    item.sourceUrl ? `- url: ${item.sourceUrl}` : "- url: n/a",
    `- text: ${escapeMarkdown(item.text.slice(0, 400))}${item.text.length > 400 ? "..." : ""}`,
  ].join("\n")).join("\n\n");

  return [
    `# Scout Topic Report: ${result.topicId}`,
    "",
    `Generated at: ${result.generatedAt}`,
    "",
    "## Summary",
    "",
    `- vertical: \`${result.vertical}\``,
    `- raw records: ${result.rawRecordCount}`,
    `- normalized evidence: ${result.evidenceCount}`,
    `- skipped dry-run records: ${result.skippedDryRunCount}`,
    `- duplicate records: ${result.duplicateCount}`,
    `- parse errors: ${result.parseErrorCount}`,
    `- normalized: \`${result.normalizedPath}\``,
    `- GameLens handoff: \`${result.gameLensHandoffPath}\``,
    "",
    "## Provider Coverage",
    "",
    "| provider | raw | normalized | dry-run skipped | duplicates | parse errors |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    providerRows,
    "",
    "## Query Coverage",
    "",
    "| provider | query | evidence |",
    "| --- | --- | ---: |",
    queryRows,
    "",
    "## Samples",
    "",
    sampleSections || "No normalized evidence samples available.",
    "",
  ].join("\n");
}

function buildQueryRows(evidence: GameLensEvidenceItem[]): string {
  if (evidence.length === 0) return "| none | none | 0 |";
  const counts = new Map<string, number>();
  for (const item of evidence) {
    const key = `${String(item.metrics.scoutProvider || "unknown")}\t${String(item.metrics.scoutQuery || "unknown")}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, count]) => {
    const [provider, query] = key.split("\t");
    return `| ${provider} | ${escapeMarkdown(query || "unknown")} | ${count} |`;
  }).join("\n");
}

function escapeMarkdown(value: string): string {
  return value.replace(/[|`]/g, "\\$&").replace(/\r?\n/g, " ").trim();
}
