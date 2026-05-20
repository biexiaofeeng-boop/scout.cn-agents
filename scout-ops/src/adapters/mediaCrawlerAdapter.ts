import fs from "node:fs/promises";
import path from "node:path";
import { UnifiedEvent } from "../models.js";

type Cursor = Record<string, number>;

async function findJsonlFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl") && full.includes(`${path.sep}jsonl${path.sep}`)) {
        files.push(full);
      }
    }
  }

  await walk(root);
  return files.sort();
}

function eventTypeFromFile(filePath: string): UnifiedEvent["eventType"] {
  const n = path.basename(filePath).toLowerCase();
  if (n.includes("comment")) return "comment";
  if (n.includes("dynamic")) return "dynamic";
  return "content";
}

function pick<T extends Record<string, unknown>>(item: T, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = item[key];
    if (value !== undefined && value !== null && String(value) !== "") return String(value);
  }
  return fallback;
}

function extractMetrics(item: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of [
    "liked_count",
    "collected_count",
    "comment_count",
    "share_count",
    "like_count",
    "read_num",
  ]) {
    if (item[key] !== undefined && item[key] !== null) out[key] = item[key];
  }
  return out;
}

export class MediaCrawlerAdapter {
  constructor(
    private readonly mediaCrawlerRoot: string,
    private readonly batchSize: number,
  ) {}

  async loadIncremental(cursor: Cursor): Promise<{ events: UnifiedEvent[]; cursor: Cursor }> {
    const dataRoot = path.join(this.mediaCrawlerRoot, "data");
    const files = await findJsonlFiles(dataRoot);
    const nextCursor: Cursor = { ...cursor };
    const events: UnifiedEvent[] = [];

    for (const filePath of files) {
      if (events.length >= this.batchSize) break;

      const key = path.resolve(filePath);
      const lastLine = Number(cursor[key] || 0);
      const lines = (await fs.readFile(filePath, "utf-8")).split("\n");
      const platform = filePath.split(path.sep).at(-3) || "unknown";
      const eventType = eventTypeFromFile(filePath);

      let currentLine = 0;
      for (const line of lines) {
        currentLine += 1;
        if (currentLine <= lastLine) continue;
        if (!line.trim()) continue;

        let item: Record<string, unknown>;
        try {
          item = JSON.parse(line) as Record<string, unknown>;
        } catch {
          continue;
        }

        events.push({
          source: "mediacrawler",
          sourceId: `${key}:${currentLine}`,
          platform,
          eventType,
          accountId: pick(item, ["user_id", "author_id", "uid", "account_id"]),
          accountName: pick(item, ["nickname", "author", "user_name", "account"]),
          contentId: pick(item, ["note_id", "aweme_id", "video_id", "content_id", "post_id", "id"]),
          title: pick(item, ["title"]),
          body: pick(item, ["desc", "content", "text", "digest"]),
          url: pick(item, ["note_url", "url", "article_url", "content_url"]),
          publishedAt: pick(item, ["publish_time", "create_time", "time", "created_at", "updated_time"]),
          collectedAt: new Date().toISOString(),
          metrics: extractMetrics(item),
          rawPayload: item,
        });

        if (events.length >= this.batchSize) break;
      }
      nextCursor[key] = currentLine;
    }

    return { events, cursor: nextCursor };
  }
}
