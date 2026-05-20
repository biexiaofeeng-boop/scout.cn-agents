import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { loadInboxPacks } from "../inboxReader.js";
import { applyTaskPack, diffTaskPack, archivePack } from "../inboxMerger.js";

describe("inbox reader", () => {
  let tempDir: string;
  beforeEach(async () => { tempDir = await fs.mkdtemp(path.join(tmpdir(), "scout-inbox-")); });
  afterEach(async () => { await fs.rm(tempDir, { recursive: true, force: true }); });

  it("returns empty when no inbox exists", async () => {
    const result = await loadInboxPacks(tempDir);
    expect(result.packs).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("loads a well-formed pack", async () => {
    await fs.mkdir(path.join(tempDir, "projects", "finance", "task-packs"), { recursive: true });
    const yaml = `projectId: finance
topics:
  - id: t-1
    name: Topic One
    vertical: finance
seeds:
  - keywordId: K-1
    keyword: hello
`;
    await fs.writeFile(path.join(tempDir, "projects", "finance", "task-packs", "p.yaml"), yaml);
    const result = await loadInboxPacks(tempDir);
    expect(result.errors).toEqual([]);
    expect(result.packs.length).toBe(1);
    expect(result.packs[0].pack.topics?.[0]?.id).toBe("t-1");
  });

  it("flags missing required fields", async () => {
    await fs.mkdir(path.join(tempDir, "projects", "x", "task-packs"), { recursive: true });
    await fs.writeFile(path.join(tempDir, "projects", "x", "task-packs", "p.yaml"), `projectId: x\ntopics:\n  - id: t1\n`);
    const result = await loadInboxPacks(tempDir);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toMatch(/name is required/);
  });

  it("rejects projectId/folder mismatch", async () => {
    await fs.mkdir(path.join(tempDir, "projects", "a", "task-packs"), { recursive: true });
    await fs.writeFile(path.join(tempDir, "projects", "a", "task-packs", "p.yaml"), `projectId: b\n`);
    const result = await loadInboxPacks(tempDir);
    expect(result.errors[0].message).toMatch(/projectId mismatch/);
  });
});

describe("inbox merger", () => {
  let tempDir: string;
  let topicsPath: string;
  let seedsPath: string;
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), "scout-merger-"));
    topicsPath = path.join(tempDir, "scout-topics.json");
    seedsPath = path.join(tempDir, "trend-seeds.csv");
    await fs.writeFile(topicsPath, "[]\n");
    await fs.writeFile(seedsPath, "keyword_id,keyword,normalized_keyword,topic_cluster,trend_type,priority,confidence,suggested_platforms,query_variants,crawl_goal,risk_flag,notes\n");
  });
  afterEach(async () => { await fs.rm(tempDir, { recursive: true, force: true }); });

  const samplePack = {
    projectId: "finance",
    topics: [{ id: "fin-1", name: "Finance one", vertical: "finance" as const, dataSources: ["reddit"] }],
    seeds: [{ keywordId: "FIN-1", keyword: "finance one", queryVariants: ["alt1", "alt2"] }],
  };

  it("diff reports new topics and seeds against empty config", async () => {
    const diff = await diffTaskPack(samplePack, topicsPath, seedsPath);
    expect(diff.newTopics.length).toBe(1);
    expect(diff.newSeeds.length).toBe(1);
    expect(diff.updatedTopics.length).toBe(0);
  });

  it("apply writes topics with enriched defaults and projectId", async () => {
    await applyTaskPack(samplePack, topicsPath, seedsPath);
    const raw = await fs.readFile(topicsPath, "utf-8");
    const data = JSON.parse(raw);
    expect(data[0].id).toBe("fin-1");
    expect(data[0].projectId).toBe("finance");
    expect(data[0].status).toBe("active");
    expect(data[0].priority).toBe("medium");
  });

  it("apply writes seeds with pipe-joined variants", async () => {
    await applyTaskPack(samplePack, topicsPath, seedsPath);
    const raw = await fs.readFile(seedsPath, "utf-8");
    expect(raw).toContain("alt1|alt2");
  });

  it("apply is idempotent on a second run", async () => {
    await applyTaskPack(samplePack, topicsPath, seedsPath);
    const first = await fs.readFile(topicsPath, "utf-8");
    const second = await applyTaskPack(samplePack, topicsPath, seedsPath);
    expect(second.topicsAdded).toBe(0);
    expect(second.topicsUpdated).toBe(0);
    const afterRaw = await fs.readFile(topicsPath, "utf-8");
    expect(afterRaw).toBe(first);
  });

  it("apply updates existing topic when content differs", async () => {
    await applyTaskPack(samplePack, topicsPath, seedsPath);
    const modified = {
      ...samplePack,
      topics: [{ ...samplePack.topics[0], name: "Finance one renamed" }],
    };
    const result = await applyTaskPack(modified, topicsPath, seedsPath);
    expect(result.topicsUpdated).toBe(1);
    expect(result.topicsAdded).toBe(0);
  });

  it("archivePack moves the file under _synced/", async () => {
    const dir = path.join(tempDir, "task-packs");
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, "p.yaml");
    await fs.writeFile(file, "projectId: x\n");
    const target = await archivePack(file);
    expect(target).toContain("_synced");
    await expect(fs.access(file)).rejects.toThrow();
    await expect(fs.access(target)).resolves.toBeUndefined();
  });
});
