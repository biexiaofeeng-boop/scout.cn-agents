import fs from "node:fs/promises";

export type SeedKeyword = {
  keywordId: string;
  keyword: string;
  normalizedKeyword: string;
  topicCluster: string;
  trendType: string;
  priority: string;
  confidence: string;
  suggestedPlatforms: string[];
  queryVariants: string[];
  crawlGoal: string;
  riskFlag: string;
  notes: string;
};

export async function loadSeeds(csvPath: string): Promise<Record<string, SeedKeyword>> {
  let raw = "";
  try {
    raw = await fs.readFile(csvPath, "utf-8");
  } catch {
    return {};
  }
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return {};
  const header = parseCsvLine(lines[0]);
  const idx = (col: string) => header.indexOf(col);
  const map: Record<string, SeedKeyword> = {};
  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    if (fields.length < 2) continue;
    const id = fields[idx("keyword_id")] || "";
    if (!id) continue;
    map[id] = {
      keywordId: id,
      keyword: fields[idx("keyword")] || "",
      normalizedKeyword: fields[idx("normalized_keyword")] || "",
      topicCluster: fields[idx("topic_cluster")] || "",
      trendType: fields[idx("trend_type")] || "",
      priority: fields[idx("priority")] || "",
      confidence: fields[idx("confidence")] || "",
      suggestedPlatforms: splitPipe(fields[idx("suggested_platforms")]),
      queryVariants: splitPipe(fields[idx("query_variants")]),
      crawlGoal: fields[idx("crawl_goal")] || "",
      riskFlag: fields[idx("risk_flag")] || "",
      notes: fields[idx("notes")] || "",
    };
  }
  return map;
}

function parseCsvLine(line: string): string[] {
  // Minimal CSV parser: handles plain commas (no quoted fields with commas).
  // The trend-seeds.csv format uses pipe-separated lists inside single fields,
  // so simple split on "," is enough today; revisit if a future row needs quoting.
  return line.split(",").map((s) => s.trim());
}

function splitPipe(value: string | undefined): string[] {
  if (!value) return [];
  return value.split("|").map((s) => s.trim()).filter(Boolean);
}
