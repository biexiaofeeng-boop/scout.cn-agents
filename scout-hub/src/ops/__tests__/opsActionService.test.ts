import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { OpsActionService } from "../opsActionService.js";
import type { ScoutPipeline } from "../../pipeline.js";
import type { Settings } from "../../config.js";

function makeMockPipeline(tempDir: string, overrides: Partial<Settings> = {}): ScoutPipeline {
  const settings: Settings = {
    projectRoot: tempDir,
    stateDir: path.join(tempDir, "state"),
    runtimeRoot: path.join(tempDir, "runtime"),
    vendorRoot: path.join(tempDir, "vendor"),
    mediaCrawlerRoot: path.join(tempDir, "mc"),
    wechatRoot: path.join(tempDir, "wechat"),
    wechatEnableDb: false,
    pipelineTickEnabled: false,
    opsShowPipelineViews: false,
    batchSize: 100,
    alertDlqThreshold: 10,
    schedulerIntervalSec: 300,
    opsActionTimeoutMs: 5000,
    opsRunRetentionDays: 30,
    opsRunRetentionMax: 100,
    monitorHost: "127.0.0.1",
    monitorPort: 18080,
    mediaCrawlerApiUrl: "http://127.0.0.1:18081",
    wechatSpiderUrl: "http://127.0.0.1:8080",
    wechatMysqlHost: "127.0.0.1",
    wechatMysqlPort: 3306,
    wechatMysqlDb: "test",
    wechatMysqlUser: "root",
    wechatMysqlPasswd: "",
    ...overrides,
  };
  return { settings } as unknown as ScoutPipeline;
}

async function writeTopicCatalog(projectRoot: string, topics: Array<Record<string, unknown>>): Promise<void> {
  const filePath = path.join(projectRoot, "scout-media-agents", "config", "topics", "scout-topics.json");
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(topics, null, 2), "utf-8");
}

describe("OpsActionService.prepareRequest", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), "scout-action-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("throws when topicId is not in the catalog", async () => {
    await writeTopicCatalog(tempDir, [
      { id: "known-topic", projectId: "scout", name: "Known", vertical: "game", dataSources: ["steam"], status: "active" },
    ]);
    const service = new OpsActionService(makeMockPipeline(tempDir));
    await expect(() => (service as unknown as { prepareRequest: Function }).prepareRequest("collect-topic", { topicId: "unknown-topic", providers: ["steam"] }))
      .rejects.toThrow(/Unknown topicId/);
  });

  it("throws when provider is not in OPS_COLLECTABLE_PROVIDER_IDS", async () => {
    await writeTopicCatalog(tempDir, [
      { id: "t1", projectId: "scout", name: "T1", vertical: "game", dataSources: ["mediacrawler"], status: "active" },
    ]);
    const service = new OpsActionService(makeMockPipeline(tempDir));
    await expect(() => (service as unknown as { prepareRequest: Function }).prepareRequest("collect-topic", { topicId: "t1", providers: ["mediacrawler"] }))
      .rejects.toThrow(/not enabled for SO2/);
  });

  it("throws when provider is not in the topic dataSources", async () => {
    await writeTopicCatalog(tempDir, [
      { id: "t1", projectId: "scout", name: "T1", vertical: "game", dataSources: ["steam"], status: "active" },
    ]);
    const service = new OpsActionService(makeMockPipeline(tempDir));
    await expect(() => (service as unknown as { prepareRequest: Function }).prepareRequest("collect-topic", { topicId: "t1", providers: ["youtube"] }))
      .rejects.toThrow(/not configured for topic/);
  });

  it("throws when required env var is missing for non-dry-run", async () => {
    delete process.env.YOUTUBE_API_KEY;
    await writeTopicCatalog(tempDir, [
      { id: "t1", projectId: "scout", name: "T1", vertical: "game", dataSources: ["youtube"], status: "active" },
    ]);
    const service = new OpsActionService(makeMockPipeline(tempDir));
    await expect(() => (service as unknown as { prepareRequest: Function }).prepareRequest("collect-topic", { topicId: "t1", providers: ["youtube"], dryRun: false }))
      .rejects.toThrow(/environment configuration/);
  });

  it("allows missing env var when dry-run is set", async () => {
    delete process.env.YOUTUBE_API_KEY;
    await writeTopicCatalog(tempDir, [
      { id: "t1", projectId: "scout", name: "T1", vertical: "game", dataSources: ["youtube"], status: "active" },
    ]);
    const service = new OpsActionService(makeMockPipeline(tempDir));
    const prepared = await (service as unknown as { prepareRequest: (a: string, i: unknown) => Promise<{ providers: string[]; dryRun: boolean }> })
      .prepareRequest("collect-topic", { topicId: "t1", providers: ["youtube"], dryRun: true });
    expect(prepared.providers).toEqual(["youtube"]);
    expect(prepared.dryRun).toBe(true);
  });

  it("clamps limit to a max of 25", async () => {
    await writeTopicCatalog(tempDir, [
      { id: "t1", projectId: "scout", name: "T1", vertical: "game", dataSources: ["steam"], status: "active" },
    ]);
    const service = new OpsActionService(makeMockPipeline(tempDir));
    const prepared = await (service as unknown as { prepareRequest: (a: string, i: unknown) => Promise<{ limit: number }> })
      .prepareRequest("collect-topic", { topicId: "t1", providers: ["steam"], limit: 999 });
    expect(prepared.limit).toBe(25);
  });
});

describe("OpsActionService.cleanupRuns", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), "scout-cleanup-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function makeRun(runId: string, opts: { status?: string; ageMs?: number } = {}): Promise<void> {
    const runDir = path.join(tempDir, "runtime", "runs", runId);
    await fs.mkdir(runDir, { recursive: true });
    await fs.writeFile(path.join(runDir, "summary.json"), JSON.stringify({
      runId,
      status: opts.status || "success",
      startedAt: new Date().toISOString(),
    }, null, 2), "utf-8");
    if (opts.ageMs) {
      const past = new Date(Date.now() - opts.ageMs);
      await fs.utimes(runDir, past, past);
    }
  }

  it("preserves runs with status=running even when older than retention", async () => {
    const pipeline = makeMockPipeline(tempDir, { opsRunRetentionDays: 7, opsRunRetentionMax: 100 });
    const service = new OpsActionService(pipeline);
    await makeRun("scout_run_inflight", { status: "running", ageMs: 100 * 24 * 60 * 60 * 1000 });
    const result = await service.cleanupRuns();
    expect(result.deletedRunIds).not.toContain("scout_run_inflight");
    const stillExists = await fs.access(path.join(tempDir, "runtime", "runs", "scout_run_inflight")).then(() => true).catch(() => false);
    expect(stillExists).toBe(true);
  });

  it("deletes runs older than retentionDays", async () => {
    const pipeline = makeMockPipeline(tempDir, { opsRunRetentionDays: 7, opsRunRetentionMax: 100 });
    const service = new OpsActionService(pipeline);
    await makeRun("scout_run_old", { status: "success", ageMs: 10 * 24 * 60 * 60 * 1000 });
    await makeRun("scout_run_fresh", { status: "success", ageMs: 1 * 24 * 60 * 60 * 1000 });
    const result = await service.cleanupRuns();
    expect(result.deletedRunIds).toContain("scout_run_old");
    expect(result.deletedRunIds).not.toContain("scout_run_fresh");
  });

  it("keeps the newest N runs when retentionMax is small", async () => {
    const pipeline = makeMockPipeline(tempDir, { opsRunRetentionDays: 0, opsRunRetentionMax: 2 });
    const service = new OpsActionService(pipeline);
    for (let i = 0; i < 4; i++) {
      await makeRun(`scout_run_n${i}`, { status: "success", ageMs: (4 - i) * 60 * 1000 });
    }
    const result = await service.cleanupRuns();
    expect(result.keptCount).toBe(2);
    expect(result.deletedCount).toBe(2);
  });

  it("is idempotent on a second call", async () => {
    const pipeline = makeMockPipeline(tempDir, { opsRunRetentionDays: 7, opsRunRetentionMax: 100 });
    const service = new OpsActionService(pipeline);
    await makeRun("scout_run_old", { status: "success", ageMs: 10 * 24 * 60 * 60 * 1000 });
    await makeRun("scout_run_fresh", { status: "success", ageMs: 60 * 1000 });
    const first = await service.cleanupRuns();
    expect(first.deletedCount).toBe(1);
    expect(first.keptCount).toBe(1);
    const second = await service.cleanupRuns();
    expect(second.deletedCount).toBe(0);
    expect(second.keptCount).toBe(1);
  });
});
