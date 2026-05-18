import fs from "node:fs/promises";
import path from "node:path";
import type { OpsActionRun, OpsReviewItem, OpsReviewStatus } from "./types.js";

export class OpsReviewService {
  constructor(private readonly runtimeRoot: string) {}

  async list(limit = 30): Promise<OpsReviewItem[]> {
    const reviewDir = this.reviewDir();
    let files: string[] = [];
    try {
      files = await fs.readdir(reviewDir);
    } catch {
      return [];
    }
    const items = await Promise.all(files
      .filter((file) => file.endsWith(".json"))
      .map((file) => readJson<OpsReviewItem>(path.join(reviewDir, file))));
    return items
      .filter((item): item is OpsReviewItem => Boolean(item?.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async createFromRun(run: OpsActionRun, normalized?: Record<string, unknown>): Promise<OpsReviewItem | undefined> {
    if (run.status === "failed") return undefined;
    if (run.action === "collect-topic") return undefined;
    if (run.normalizedEvidenceCount <= 0 && !run.dryRun) return undefined;

    const now = new Date().toISOString();
    const item: OpsReviewItem = {
      id: `review_${run.runId}`,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      runId: run.runId,
      action: run.action,
      topicId: run.topicId,
      vertical: run.vertical,
      providers: run.providers,
      dryRun: run.dryRun,
      rawRecordCount: run.rawRecordCount,
      normalizedEvidenceCount: run.normalizedEvidenceCount,
      normalizedPath: stringField(normalized?.normalizedPath),
      handoffPath: stringField(normalized?.gameLensHandoffPath),
      reportPath: stringField(normalized?.reportPath) || run.reportPath,
    };

    await writeJson(this.itemPath(item.id), item);
    return item;
  }

  async decide(id: string, status: OpsReviewStatus, reviewer = "ops", decisionNote = ""): Promise<OpsReviewItem | undefined> {
    if (!["approved", "rejected"].includes(status)) throw new Error("Review status must be approved or rejected.");
    const safeId = sanitizeReviewId(id);
    if (!safeId) return undefined;
    const item = await readJson<OpsReviewItem>(this.itemPath(safeId));
    if (!item) return undefined;
    const updated: OpsReviewItem = {
      ...item,
      status,
      reviewer: reviewer.trim() || "ops",
      decisionNote: decisionNote.trim(),
      updatedAt: new Date().toISOString(),
    };
    await writeJson(this.itemPath(safeId), updated);
    return updated;
  }

  private reviewDir(): string {
    return path.join(this.runtimeRoot, "review-queue");
  }

  private itemPath(id: string): string {
    return path.join(this.reviewDir(), `${sanitizeReviewId(id)}.json`);
  }
}

function sanitizeReviewId(id: string): string {
  return /^review_scout_run_[a-zA-Z0-9_.:-]+$/.test(id) ? id : "";
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function readJson<T>(filePath: string): Promise<T | undefined> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf-8");
}
