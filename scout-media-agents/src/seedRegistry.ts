import fs from "node:fs/promises";
import path from "node:path";
import { parseCsv } from "./csv.js";
import { Confidence, CrawlGoal, Priority, RiskLevel, SeedKeyword, TrendType } from "./types.js";
import { uniqueStrings } from "./utils.js";

const VALID_TREND_TYPES = new Set<TrendType>(["technology", "event", "actor", "market", "health", "topic"]);
const VALID_PRIORITY = new Set<Priority>(["low", "medium", "high"]);
const VALID_CONFIDENCE = new Set<Confidence>(["low", "medium", "high"]);
const VALID_RISK = new Set<RiskLevel>(["low", "medium", "high"]);
const VALID_GOALS = new Set<CrawlGoal>(["trend_discovery", "narrative_monitoring", "risk_monitoring", "actor_watch"]);

type SeedRow = Record<string, string>;

function splitPipe(value: string): string[] {
  return uniqueStrings(value.split("|").map((item) => item.trim()));
}

function coerceTrendType(value: string): TrendType {
  return VALID_TREND_TYPES.has(value as TrendType) ? (value as TrendType) : "topic";
}

function coercePriority(value: string): Priority {
  return VALID_PRIORITY.has(value as Priority) ? (value as Priority) : "medium";
}

function coerceConfidence(value: string): Confidence {
  return VALID_CONFIDENCE.has(value as Confidence) ? (value as Confidence) : "medium";
}

function coerceRisk(value: string): RiskLevel {
  return VALID_RISK.has(value as RiskLevel) ? (value as RiskLevel) : "medium";
}

function coerceGoal(value: string): CrawlGoal {
  return VALID_GOALS.has(value as CrawlGoal) ? (value as CrawlGoal) : "trend_discovery";
}

function rowToSeedKeyword(row: SeedRow, index: number): SeedKeyword {
  const keyword = (row.keyword || "").trim();
  const normalizedKeyword = (row.normalized_keyword || keyword).trim() || keyword;
  return {
    id: index + 1,
    keywordId: (row.keyword_id || `SEED-${String(index + 1).padStart(3, "0")}`).trim(),
    keyword,
    normalizedKeyword,
    topicCluster: (row.topic_cluster || "general").trim() || "general",
    trendType: coerceTrendType((row.trend_type || "topic").trim()),
    priority: coercePriority((row.priority || "medium").trim()),
    confidence: coerceConfidence((row.confidence || "medium").trim()),
    suggestedPlatforms: splitPipe(row.suggested_platforms || ""),
    queryVariants: splitPipe(row.query_variants || ""),
    crawlGoal: coerceGoal((row.crawl_goal || "trend_discovery").trim()),
    riskFlag: coerceRisk((row.risk_flag || "medium").trim()),
    notes: (row.notes || "").trim(),
  };
}

export async function loadSeedRegistry(seedFile: string): Promise<SeedKeyword[]> {
  const csvText = await fs.readFile(seedFile, "utf-8");
  const rows = parseCsv(csvText);
  if (rows.length < 2) return [];

  const header = rows[0].map((item) => item.trim());
  const out: SeedKeyword[] = [];
  for (let idx = 1; idx < rows.length; idx += 1) {
    const raw = rows[idx];
    const row: SeedRow = {};
    for (let col = 0; col < header.length; col += 1) {
      row[header[col]] = (raw[col] || "").trim();
    }
    if (!row.keyword?.trim()) continue;
    out.push(rowToSeedKeyword(row, out.length));
  }

  return out;
}

export function defaultSeedFile(projectRoot: string): string {
  return path.join(projectRoot, "config", "trend-seeds.csv");
}
