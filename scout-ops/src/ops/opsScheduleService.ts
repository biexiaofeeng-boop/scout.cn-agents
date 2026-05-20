import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Cron } from "croner";
import type { OpsActionName, OpsActionRunStatus, OpsSchedule, OpsScheduleStatus } from "./types.js";
import type { OpsActionService } from "./opsActionService.js";

export type OpsScheduleCreateInput = {
  topicId: string;
  projectId?: string;
  providers: string[];
  action: OpsActionName;
  query?: string;
  limit: number;
  dryRun: boolean;
  cron: string;
  timezone?: string;
  createdBy?: string;
};

export type OpsScheduleUpdateInput = Partial<{
  providers: string[];
  query: string;
  limit: number;
  dryRun: boolean;
  cron: string;
  timezone: string;
  status: OpsScheduleStatus;
}>;

const DEFAULT_TIMEZONE = "Asia/Shanghai";

export class OpsScheduleService {
  constructor(private readonly runtimeRoot: string) {}

  async list(limit = 100): Promise<OpsSchedule[]> {
    const dir = this.dir();
    let files: string[] = [];
    try {
      files = await fs.readdir(dir);
    } catch {
      return [];
    }
    const items = await Promise.all(files
      .filter((file) => file.endsWith(".json"))
      .map((file) => readJson<OpsSchedule>(path.join(dir, file))));
    return items
      .filter((item): item is OpsSchedule => Boolean(item?.id))
      .sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt))
      .slice(0, limit);
  }

  async get(id: string): Promise<OpsSchedule | undefined> {
    const safeId = sanitizeScheduleId(id);
    if (!safeId) return undefined;
    return readJson<OpsSchedule>(this.itemPath(safeId));
  }

  async create(input: OpsScheduleCreateInput): Promise<OpsSchedule> {
    if (!input.topicId) throw new Error("topicId is required");
    if (!Array.isArray(input.providers) || input.providers.length === 0) {
      throw new Error("at least one provider is required");
    }
    if (!input.action) throw new Error("action is required");
    if (!input.cron) throw new Error("cron is required");
    const timezone = input.timezone || DEFAULT_TIMEZONE;
    const next = computeNextRun(input.cron, timezone, new Date());
    if (!next) throw new Error("invalid cron expression");

    const id = `schedule_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const now = new Date().toISOString();
    const schedule: OpsSchedule = {
      id,
      topicId: input.topicId,
      projectId: input.projectId || "",
      providers: [...new Set(input.providers)],
      action: input.action,
      query: input.query?.trim() || undefined,
      limit: clampLimit(input.limit),
      dryRun: !!input.dryRun,
      cron: input.cron,
      timezone,
      status: "active",
      nextRunAt: next.toISOString(),
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy?.trim() || undefined,
    };
    await writeJson(this.itemPath(id), schedule);
    return schedule;
  }

  async update(id: string, patch: OpsScheduleUpdateInput): Promise<OpsSchedule | undefined> {
    const existing = await this.get(id);
    if (!existing) return undefined;
    let { cron, timezone, nextRunAt } = existing;
    const cronChanged = patch.cron !== undefined && patch.cron !== existing.cron;
    const tzChanged = patch.timezone !== undefined && patch.timezone !== existing.timezone;
    if (cronChanged || tzChanged) {
      cron = patch.cron ?? existing.cron;
      timezone = patch.timezone ?? existing.timezone;
      const next = computeNextRun(cron, timezone, new Date());
      if (!next) throw new Error("invalid cron expression");
      nextRunAt = next.toISOString();
    }
    const updated: OpsSchedule = {
      ...existing,
      providers: patch.providers ? [...new Set(patch.providers)] : existing.providers,
      query: patch.query !== undefined ? (patch.query.trim() || undefined) : existing.query,
      limit: patch.limit !== undefined ? clampLimit(patch.limit) : existing.limit,
      dryRun: patch.dryRun !== undefined ? !!patch.dryRun : existing.dryRun,
      cron,
      timezone,
      status: patch.status ?? existing.status,
      nextRunAt,
      updatedAt: new Date().toISOString(),
    };
    await writeJson(this.itemPath(updated.id), updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const safeId = sanitizeScheduleId(id);
    if (!safeId) return false;
    try {
      await fs.unlink(this.itemPath(safeId));
      return true;
    } catch {
      return false;
    }
  }

  async runDue(opsActionService: OpsActionService): Promise<string[]> {
    const schedules = await this.list(500);
    const now = new Date();
    const due = schedules.filter((schedule) =>
      schedule.status === "active" && new Date(schedule.nextRunAt) <= now
    );
    const triggered: string[] = [];
    for (const schedule of due) {
      let lastRunId: string | undefined;
      let lastRunStatus: OpsActionRunStatus = "failed";
      let lastRunStartedAt = new Date().toISOString();
      try {
        const run = await opsActionService.run(schedule.action, {
          topicId: schedule.topicId,
          projectId: schedule.projectId || undefined,
          providers: schedule.providers,
          query: schedule.query,
          limit: schedule.limit,
          dryRun: schedule.dryRun,
        });
        lastRunId = run.runId;
        lastRunStatus = run.status;
        lastRunStartedAt = run.startedAt;
        triggered.push(schedule.id);
      } catch {
        // keep lastRunStatus="failed"; advance nextRunAt so we don't loop on a broken schedule
      }
      const next = computeNextRun(schedule.cron, schedule.timezone, now);
      const refreshed = await this.get(schedule.id);
      if (!refreshed) continue;
      const persisted: OpsSchedule = {
        ...refreshed,
        lastRunAt: lastRunStartedAt,
        lastRunId,
        lastRunStatus,
        nextRunAt: next ? next.toISOString() : refreshed.nextRunAt,
        updatedAt: new Date().toISOString(),
      };
      await writeJson(this.itemPath(refreshed.id), persisted);
    }
    return triggered;
  }

  async runNow(id: string, opsActionService: OpsActionService): Promise<{ runId: string; status: OpsActionRunStatus } | undefined> {
    const schedule = await this.get(id);
    if (!schedule) return undefined;
    const run = await opsActionService.run(schedule.action, {
      topicId: schedule.topicId,
      projectId: schedule.projectId || undefined,
      providers: schedule.providers,
      query: schedule.query,
      limit: schedule.limit,
      dryRun: schedule.dryRun,
    });
    const refreshed = await this.get(schedule.id);
    if (refreshed) {
      const next = computeNextRun(refreshed.cron, refreshed.timezone, new Date());
      const updated: OpsSchedule = {
        ...refreshed,
        lastRunAt: run.startedAt,
        lastRunId: run.runId,
        lastRunStatus: run.status,
        nextRunAt: next ? next.toISOString() : refreshed.nextRunAt,
        updatedAt: new Date().toISOString(),
      };
      await writeJson(this.itemPath(refreshed.id), updated);
    }
    return { runId: run.runId, status: run.status };
  }

  private dir(): string {
    return path.join(this.runtimeRoot, "schedules");
  }

  private itemPath(id: string): string {
    return path.join(this.dir(), `${sanitizeScheduleId(id)}.json`);
  }
}

export function sanitizeScheduleId(id: string): string {
  return /^schedule_[a-zA-Z0-9_-]+$/.test(id) ? id : "";
}

function clampLimit(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 10;
  return Math.max(1, Math.min(25, Math.floor(n)));
}

function computeNextRun(cron: string, timezone: string, from: Date): Date | null {
  try {
    const instance = new Cron(cron, { paused: true, timezone });
    return instance.nextRun(from);
  } catch {
    return null;
  }
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
