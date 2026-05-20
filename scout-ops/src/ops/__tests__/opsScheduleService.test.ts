import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { OpsScheduleService, sanitizeScheduleId } from "../opsScheduleService.js";

describe("sanitizeScheduleId", () => {
  it("rejects path traversal", () => {
    expect(sanitizeScheduleId("schedule_../passwd")).toBe("");
  });

  it("rejects forward slash", () => {
    expect(sanitizeScheduleId("schedule_/abc")).toBe("");
  });

  it("rejects ids without schedule_ prefix", () => {
    expect(sanitizeScheduleId("abc")).toBe("");
    expect(sanitizeScheduleId("evil_schedule_abc")).toBe("");
  });

  it("accepts well-formed ids with hyphens and underscores", () => {
    expect(sanitizeScheduleId("schedule_abc123-def_ghi")).toBe("schedule_abc123-def_ghi");
  });
});

describe("OpsScheduleService.create", () => {
  let tempDir: string;
  let service: OpsScheduleService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), "scout-schedule-"));
    service = new OpsScheduleService(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("creates a schedule and computes a future nextRunAt", async () => {
    const schedule = await service.create({
      topicId: "topic-test",
      providers: ["steam"],
      action: "collect-and-normalize-topic",
      limit: 10,
      dryRun: false,
      cron: "0 9 * * *",
    });
    expect(schedule.id).toMatch(/^schedule_[a-zA-Z0-9_-]+$/);
    expect(schedule.status).toBe("active");
    expect(new Date(schedule.nextRunAt).getTime()).toBeGreaterThan(Date.now());
    expect(schedule.timezone).toBe("Asia/Shanghai");
  });

  it("rejects an invalid cron expression", async () => {
    await expect(() => service.create({
      topicId: "t",
      providers: ["steam"],
      action: "collect-topic",
      limit: 10,
      dryRun: false,
      cron: "not-a-cron",
    })).rejects.toThrow(/invalid cron/);
  });

  it("requires at least one provider", async () => {
    await expect(() => service.create({
      topicId: "t",
      providers: [],
      action: "collect-topic",
      limit: 10,
      dryRun: false,
      cron: "0 9 * * *",
    })).rejects.toThrow(/provider/);
  });

  it("requires topicId", async () => {
    await expect(() => service.create({
      topicId: "",
      providers: ["steam"],
      action: "collect-topic",
      limit: 10,
      dryRun: false,
      cron: "0 9 * * *",
    })).rejects.toThrow(/topicId/);
  });

  it("clamps limit to [1, 25]", async () => {
    const big = await service.create({
      topicId: "t",
      providers: ["steam"],
      action: "collect-topic",
      limit: 999,
      dryRun: false,
      cron: "0 9 * * *",
    });
    expect(big.limit).toBe(25);
    const small = await service.create({
      topicId: "t",
      providers: ["steam"],
      action: "collect-topic",
      limit: -5,
      dryRun: false,
      cron: "0 9 * * *",
    });
    expect(small.limit).toBe(1);
  });
});

describe("OpsScheduleService.update + delete", () => {
  let tempDir: string;
  let service: OpsScheduleService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), "scout-schedule-up-"));
    service = new OpsScheduleService(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function freshSchedule() {
    return service.create({
      topicId: "t",
      providers: ["steam"],
      action: "collect-topic",
      limit: 10,
      dryRun: false,
      cron: "0 9 * * *",
    });
  }

  it("recomputes nextRunAt when cron changes", async () => {
    const original = await freshSchedule();
    const updated = await service.update(original.id, { cron: "0 15 * * *" });
    expect(updated?.cron).toBe("0 15 * * *");
    expect(updated?.nextRunAt).not.toBe(original.nextRunAt);
  });

  it("returns undefined for unknown id", async () => {
    const result = await service.update("schedule_does_not_exist", { status: "paused" });
    expect(result).toBeUndefined();
  });

  it("rejects an invalid cron on update", async () => {
    const original = await freshSchedule();
    await expect(() => service.update(original.id, { cron: "bogus" }))
      .rejects.toThrow(/invalid cron/);
  });

  it("toggles status without touching cron", async () => {
    const original = await freshSchedule();
    const paused = await service.update(original.id, { status: "paused" });
    expect(paused?.status).toBe("paused");
    expect(paused?.cron).toBe(original.cron);
    expect(paused?.nextRunAt).toBe(original.nextRunAt);
  });

  it("delete removes the file and get returns undefined after", async () => {
    const original = await freshSchedule();
    expect(await service.delete(original.id)).toBe(true);
    expect(await service.get(original.id)).toBeUndefined();
  });

  it("delete returns false for malformed id", async () => {
    expect(await service.delete("../../etc/passwd")).toBe(false);
  });
});

describe("OpsScheduleService.list", () => {
  let tempDir: string;
  let service: OpsScheduleService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), "scout-schedule-list-"));
    service = new OpsScheduleService(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("returns empty array when directory does not exist", async () => {
    expect(await service.list()).toEqual([]);
  });

  it("returns schedules sorted by nextRunAt ascending", async () => {
    await service.create({
      topicId: "t", providers: ["steam"], action: "collect-topic",
      limit: 10, dryRun: false, cron: "0 9 1 1 *",
    });
    await service.create({
      topicId: "t", providers: ["steam"], action: "collect-topic",
      limit: 10, dryRun: false, cron: "0 9 * * *",
    });
    const list = await service.list();
    expect(list.length).toBe(2);
    const t0 = new Date(list[0].nextRunAt).getTime();
    const t1 = new Date(list[1].nextRunAt).getTime();
    expect(t0).toBeLessThanOrEqual(t1);
  });
});
