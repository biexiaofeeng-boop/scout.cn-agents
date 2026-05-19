import fs from "node:fs/promises";
import path from "node:path";
import type { CollectionRequest, VendorEvidenceRecord } from "../types.js";
import { nowIso, stableId } from "../utils.js";

const PLATFORM_LABELS: Record<string, string> = {
  weibo: "weibo",
  bili: "bilibili",
  douyin: "douyin",
  xhs: "xiaohongshu",
  zhihu: "zhihu",
  tieba: "tieba",
  ks: "kuaishou",
  kuaishou: "kuaishou",
};

const CONTENT_FILE_PATTERN = /^search_contents_\d{4}-\d{2}-\d{2}\.jsonl$/;

/**
 * MediaCrawler "ingest" connector.
 *
 * Unlike steam/reddit/youtube which fetch from a live API, this connector
 * reads from the files MediaCrawler has already written to disk. The
 * operator is expected to drive MediaCrawler separately (via its webui or
 * CLI); scout-hub only normalises the resulting jsonl into the shared
 * VendorEvidenceRecord schema so it can go through the review queue.
 *
 * Filtering is by the source_keyword field that MediaCrawler annotates on
 * each record when run in search mode — falling back to a content-level
 * substring match if a record lacks the field.
 */
export async function collectMediaCrawler(request: CollectionRequest): Promise<VendorEvidenceRecord[]> {
  const root = request.mediaCrawlerRoot;
  if (!root) {
    throw new Error("mediaCrawlerRoot is required for mediacrawler provider");
  }
  const dataDir = path.join(root, "data");
  let platforms: string[] = [];
  try {
    const entries = await fs.readdir(dataDir, { withFileTypes: true });
    platforms = entries.filter((e) => e.isDirectory()).map((e) => e.name).filter((n) => !n.endsWith("_debug"));
  } catch {
    return [];
  }
  const query = (request.query || "").toLowerCase();
  const records: VendorEvidenceRecord[] = [];
  const collectedAt = nowIso();
  for (const platform of platforms) {
    const jsonlDir = path.join(dataDir, platform, "jsonl");
    let files: string[] = [];
    try {
      files = (await fs.readdir(jsonlDir)).filter((f) => CONTENT_FILE_PATTERN.test(f));
    } catch {
      continue;
    }
    // Newest file first; one platform-day per ingest is plenty.
    files.sort().reverse();
    for (const fileName of files) {
      const filePath = path.join(jsonlDir, fileName);
      let raw = "";
      try {
        raw = await fs.readFile(filePath, "utf-8");
      } catch {
        continue;
      }
      const lines = raw.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        let row: Record<string, unknown> = {};
        try {
          row = JSON.parse(line) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (!matchesQuery(row, query)) continue;
        records.push(mapRecord(row, platform, request, collectedAt, fileName));
        if (records.length >= request.limit) return records;
      }
      // Stop after the newest file for this platform; rely on operator to
      // re-run if they want older days.
      break;
    }
  }
  return records;
}

function matchesQuery(row: Record<string, unknown>, query: string): boolean {
  if (!query) return true;
  const sourceKeyword = String(row["source_keyword"] || "").toLowerCase();
  if (sourceKeyword) return sourceKeyword.includes(query);
  // Fall back to content match when source_keyword missing
  const content = String(row["content"] || row["desc"] || row["title"] || "").toLowerCase();
  return content.includes(query);
}

function mapRecord(row: Record<string, unknown>, platform: string, request: CollectionRequest, collectedAt: string, fileName: string): VendorEvidenceRecord {
  const platformLabel = PLATFORM_LABELS[platform] || platform;
  const id = pickString(row, ["note_id", "aweme_id", "video_id", "answer_id", "id", "post_id"]);
  const content = pickString(row, ["content", "desc", "title", "excerpt", "text"]);
  const titleField = pickString(row, ["title", "note_title", "video_title"]);
  const title = titleField || (content ? content.slice(0, 80).replace(/\s+/g, " ").trim() : `MediaCrawler ${platformLabel} item`);
  const url = pickString(row, ["note_url", "share_url", "url", "video_play_url", "answer_url"]);
  const author = pickString(row, ["nickname", "user_name", "author", "screen_name"]);
  const publishedAt = resolvePublishedAt(row);
  const metrics = pickMetrics(row);
  return {
    id: stableId(`ev_mediacrawler_${platform}`, id || JSON.stringify(row).slice(0, 64), 0),
    provider: "mediacrawler",
    source: `mediacrawler_${platformLabel}`,
    topicId: request.topicId,
    vertical: request.vertical,
    query: request.query,
    title,
    text: content,
    url: url || undefined,
    author: author || undefined,
    publishedAt,
    collectedAt,
    market: request.market,
    language: request.language,
    metrics: { ...metrics, mediacrawlerFile: fileName },
    rawPayload: row,
  };
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const value = row[k];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function resolvePublishedAt(row: Record<string, unknown>): string | undefined {
  const iso = row["create_date_time"] || row["publish_time_iso"];
  if (typeof iso === "string" && iso.trim()) {
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const unix = row["create_time"] || row["publish_time"] || row["pubdate"];
  if (typeof unix === "number" && unix > 0) {
    const ms = unix > 1e12 ? unix : unix * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof unix === "string" && unix.trim()) {
    const n = Number(unix);
    if (Number.isFinite(n) && n > 0) {
      const ms = n > 1e12 ? n : n * 1000;
      return new Date(ms).toISOString();
    }
  }
  return undefined;
}

function pickMetrics(row: Record<string, unknown>): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  const keys = ["liked_count", "comments_count", "shared_count", "view_count", "share_count", "collected_count", "total_fans", "total_liked", "play_count"];
  for (const k of keys) {
    const value = row[k];
    if (typeof value === "number") result[k] = value;
    else if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) result[k] = Number(value);
  }
  if (typeof row["ip_location"] === "string" && row["ip_location"]) result.ipLocation = row["ip_location"];
  return result;
}
