import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { OpsReviewService, sanitizeReviewId } from "../opsReviewService.js";
import type { OpsReviewItem } from "../types.js";

describe("sanitizeReviewId", () => {
  it("rejects path traversal", () => {
    expect(sanitizeReviewId("review_scout_run_../etc/passwd")).toBe("");
  });

  it("rejects forward slash and backslash", () => {
    expect(sanitizeReviewId("review_scout_run_/abc")).toBe("");
    expect(sanitizeReviewId("review_scout_run_\\abc")).toBe("");
  });

  it("rejects null byte", () => {
    expect(sanitizeReviewId("review_scout_run_\0abc")).toBe("");
  });

  it("rejects ids without the required prefix", () => {
    expect(sanitizeReviewId("scout_run_abc")).toBe("");
    expect(sanitizeReviewId("review_abc")).toBe("");
    expect(sanitizeReviewId("evil_review_scout_run_abc")).toBe("");
  });

  it("accepts well-formed ids", () => {
    const id = "review_scout_run_2026-05-19T09-00-00-000Z_abcd1234";
    expect(sanitizeReviewId(id)).toBe(id);
  });
});

describe("OpsReviewService.decide", () => {
  let tempDir: string;
  let service: OpsReviewService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), "scout-review-"));
    service = new OpsReviewService(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function seed(id: string, status: "pending" | "approved" | "rejected" = "pending"): Promise<OpsReviewItem> {
    const item: OpsReviewItem = {
      id,
      status,
      createdAt: "2026-05-19T00:00:00.000Z",
      updatedAt: "2026-05-19T00:00:00.000Z",
      runId: id.replace("review_", ""),
      action: "collect-and-normalize-topic",
      topicId: "topic-test",
      projectId: "scout",
      vertical: "game",
      providers: ["steam"],
      dryRun: false,
      rawRecordCount: 5,
      normalizedEvidenceCount: 3,
      normalizedPath: "",
      handoffPath: "",
      reportPath: "",
    };
    const dir = path.join(tempDir, "review-queue");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${id}.json`), JSON.stringify(item, null, 2), "utf-8");
    return item;
  }

  it("transitions pending to approved with reviewer", async () => {
    const id = "review_scout_run_test_approve";
    await seed(id);
    const updated = await service.decide(id, "approved", "tester");
    expect(updated?.status).toBe("approved");
    expect(updated?.reviewer).toBe("tester");
  });

  it("transitions pending to rejected with decisionNote", async () => {
    const id = "review_scout_run_test_reject";
    await seed(id);
    const updated = await service.decide(id, "rejected", "tester", "bad data");
    expect(updated?.status).toBe("rejected");
    expect(updated?.decisionNote).toBe("bad data");
  });

  it("returns undefined for unknown id", async () => {
    const result = await service.decide("review_scout_run_unknown", "approved");
    expect(result).toBeUndefined();
  });

  it("returns undefined for malformed id (sanitize gate)", async () => {
    const result = await service.decide("../../etc/passwd", "approved");
    expect(result).toBeUndefined();
  });

  it("throws for invalid status value", async () => {
    await expect(() => service.decide("review_scout_run_x", "weird" as never))
      .rejects.toThrow(/Review status/);
  });

  it("does not mutate other items in the directory", async () => {
    const id1 = "review_scout_run_a";
    const id2 = "review_scout_run_b";
    await seed(id1);
    const original2 = await seed(id2);
    await service.decide(id1, "approved");
    const raw = await fs.readFile(path.join(tempDir, "review-queue", `${id2}.json`), "utf-8");
    expect(JSON.parse(raw).status).toBe(original2.status);
  });
});

describe("OpsReviewService.getPreview", () => {
  let tempDir: string;
  let service: OpsReviewService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), "scout-preview-"));
    service = new OpsReviewService(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("returns undefined for malformed id", async () => {
    const result = await service.getPreview("../../etc/passwd");
    expect(result).toBeUndefined();
  });

  it("reads first 10 normalized lines and trims handoff items", async () => {
    const id = "review_scout_run_preview_test";
    const normalizedPath = path.join(tempDir, "normalized.jsonl");
    const handoffPath = path.join(tempDir, "handoff.json");

    const records = Array.from({ length: 20 }, (_, i) => ({ source: "steam", sourceItemId: String(i), title: `item ${i}` }));
    await fs.writeFile(normalizedPath, records.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf-8");

    const handoff = { schema: "gamelens_evidence_handoff_v1", items: Array.from({ length: 20 }, (_, i) => ({ id: i })) };
    await fs.writeFile(handoffPath, JSON.stringify(handoff), "utf-8");

    const reviewDir = path.join(tempDir, "review-queue");
    await fs.mkdir(reviewDir, { recursive: true });
    const item: OpsReviewItem = {
      id, status: "pending", createdAt: "x", updatedAt: "x", runId: "x",
      action: "collect-and-normalize-topic", topicId: "t", projectId: "p", vertical: "game",
      providers: ["steam"], dryRun: false, rawRecordCount: 20, normalizedEvidenceCount: 20,
      normalizedPath, handoffPath, reportPath: "",
    };
    await fs.writeFile(path.join(reviewDir, `${id}.json`), JSON.stringify(item), "utf-8");

    const preview = await service.getPreview(id);
    expect(preview).toBeDefined();
    expect(preview!.normalizedSample.length).toBe(10);
    expect((preview!.handoff?.items as unknown[]).length).toBe(5);
    expect(preview!.handoff?._note).toContain("20");
  });
});
