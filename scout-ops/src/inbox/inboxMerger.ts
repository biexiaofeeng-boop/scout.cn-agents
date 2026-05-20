import fs from "node:fs/promises";
import path from "node:path";
import type { TaskPack, TaskPackDiff, TaskPackSeed, TaskPackTopic } from "./types.js";

const TOPICS_FIELDS_ORDER = [
  "id",
  "name",
  "description",
  "status",
  "priority",
  "vertical",
  "market",
  "language",
  "intent",
  "refreshCadence",
  "platforms",
  "dataSources",
  "owner",
  "seedKeywordIds",
  "projectId",
] as const;

export async function diffTaskPack(pack: TaskPack, topicsJsonPath: string, seedsCsvPath: string): Promise<TaskPackDiff> {
  const existingTopics = await readTopics(topicsJsonPath);
  const existingTopicIds = new Set(existingTopics.map((t) => String(t.id || "")));
  const existingTopicById = new Map(existingTopics.map((t) => [String(t.id || ""), t]));

  const newTopics: TaskPackTopic[] = [];
  const updatedTopics: TaskPackDiff["updatedTopics"] = [];
  for (const topic of pack.topics || []) {
    const enriched = enrichTopic(topic, pack.projectId);
    if (!existingTopicIds.has(topic.id)) {
      newTopics.push(topic);
      continue;
    }
    const before = existingTopicById.get(topic.id) as Record<string, unknown>;
    if (!shallowEqual(before, enriched)) {
      updatedTopics.push({ before, after: enriched });
    }
  }

  const existingSeedRows = await readSeedsCsv(seedsCsvPath);
  const existingSeedById = new Map(existingSeedRows.map((row) => [row.keyword_id, row.raw]));
  const newSeeds: TaskPackSeed[] = [];
  const updatedSeeds: TaskPackDiff["updatedSeeds"] = [];
  for (const seed of pack.seeds || []) {
    const renderedRow = seedToCsvRow(seed);
    if (!existingSeedById.has(seed.keywordId)) {
      newSeeds.push(seed);
      continue;
    }
    const before = existingSeedById.get(seed.keywordId) as string;
    if (before !== renderedRow) {
      updatedSeeds.push({ keywordId: seed.keywordId, before, after: renderedRow });
    }
  }

  return { pack, newTopics, updatedTopics, newSeeds, updatedSeeds };
}

export async function applyTaskPack(pack: TaskPack, topicsJsonPath: string, seedsCsvPath: string): Promise<{ topicsAdded: number; topicsUpdated: number; seedsAdded: number; seedsUpdated: number }> {
  // Topics: merge into existing JSON, preserving order and other entries
  const topics = await readTopics(topicsJsonPath);
  const idIndex = new Map(topics.map((t, i) => [String(t.id || ""), i]));
  let topicsAdded = 0;
  let topicsUpdated = 0;
  for (const topic of pack.topics || []) {
    const enriched = enrichTopic(topic, pack.projectId);
    if (idIndex.has(topic.id)) {
      const existing = topics[idIndex.get(topic.id)!] as Record<string, unknown>;
      if (!shallowEqual(existing, enriched)) {
        topics[idIndex.get(topic.id)!] = enriched;
        topicsUpdated += 1;
      }
    } else {
      topics.push(enriched);
      idIndex.set(topic.id, topics.length - 1);
      topicsAdded += 1;
    }
  }
  await writeTopics(topicsJsonPath, topics);

  // Seeds: merge into existing CSV
  const seedsResult = await mergeSeedsCsv(seedsCsvPath, pack.seeds || []);
  return { topicsAdded, topicsUpdated, ...seedsResult };
}

async function readTopics(filePath: string): Promise<Record<string, unknown>[]> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeTopics(filePath: string, topics: Record<string, unknown>[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(topics, null, 2) + "\n", "utf-8");
}

function enrichTopic(topic: TaskPackTopic, projectId: string): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    id: topic.id,
    projectId: projectId,
    name: topic.name,
    description: topic.description || "",
    status: topic.status || "active",
    priority: topic.priority || "medium",
    vertical: topic.vertical,
    market: topic.market || "",
    language: topic.language || "",
    intent: topic.intent || "",
    refreshCadence: topic.refreshCadence || "",
    platforms: topic.platforms || [],
    dataSources: topic.dataSources || [],
    owner: topic.owner || "",
    seedKeywordIds: topic.seedKeywordIds || [],
  };
  // Reorder according to canonical field order so JSON diffs stay stable
  const ordered: Record<string, unknown> = {};
  for (const key of TOPICS_FIELDS_ORDER) {
    if (key in merged) ordered[key] = merged[key];
  }
  return ordered;
}

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

type SeedRow = { keyword_id: string; raw: string };

async function readSeedsCsv(filePath: string): Promise<SeedRow[]> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length < 2) return [];
    return lines.slice(1).map((line) => ({ keyword_id: line.split(",", 1)[0], raw: line }));
  } catch {
    return [];
  }
}

async function mergeSeedsCsv(filePath: string, seeds: TaskPackSeed[]): Promise<{ seedsAdded: number; seedsUpdated: number }> {
  let header = "keyword_id,keyword,normalized_keyword,topic_cluster,trend_type,priority,confidence,suggested_platforms,query_variants,crawl_goal,risk_flag,notes";
  let lines: string[] = [];
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const all = raw.split(/\r?\n/).filter((l) => l.length > 0);
    if (all.length > 0) {
      header = all[0];
      lines = all.slice(1);
    }
  } catch {
    // file does not yet exist; we'll create it
  }
  const idIndex = new Map(lines.map((row, i) => [row.split(",", 1)[0], i]));
  let seedsAdded = 0;
  let seedsUpdated = 0;
  for (const seed of seeds || []) {
    const rendered = seedToCsvRow(seed);
    if (idIndex.has(seed.keywordId)) {
      const existing = lines[idIndex.get(seed.keywordId)!];
      if (existing !== rendered) {
        lines[idIndex.get(seed.keywordId)!] = rendered;
        seedsUpdated += 1;
      }
    } else {
      lines.push(rendered);
      idIndex.set(seed.keywordId, lines.length - 1);
      seedsAdded += 1;
    }
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, [header, ...lines].join("\n") + "\n", "utf-8");
  return { seedsAdded, seedsUpdated };
}

function seedToCsvRow(seed: TaskPackSeed): string {
  // Order must match the header in mergeSeedsCsv
  return [
    seed.keywordId,
    seed.keyword,
    seed.normalizedKeyword || seed.keyword,
    seed.topicCluster || "",
    seed.trendType || "",
    seed.priority || "medium",
    seed.confidence || "medium",
    (seed.suggestedPlatforms || []).join("|"),
    (seed.queryVariants || []).join("|"),
    seed.crawlGoal || "",
    seed.riskFlag || "low",
    (seed.notes || "").replace(/,/g, ";"),
  ].join(",");
}

export async function archivePack(packPath: string): Promise<string> {
  const dir = path.dirname(packPath);
  const archiveDir = path.join(dir, "_synced");
  await fs.mkdir(archiveDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = path.basename(packPath);
  const target = path.join(archiveDir, `${stamp}_${base}`);
  await fs.rename(packPath, target);
  return target;
}
