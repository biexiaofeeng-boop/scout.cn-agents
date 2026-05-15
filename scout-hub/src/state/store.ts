import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { defaultCounters, PipelineCounters, PipelineRun, recordHash, UnifiedEvent } from "../models.js";

type JsonObject = Record<string, unknown>;

export type InsertStats = {
  inserted: number;
  skipped: number;
};

export type HealthState = {
  metrics: PipelineCounters;
  dlqSize: number;
  stateDir: string;
};

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
  await fs.rename(tmpPath, filePath);
}

async function countJsonlRows(filePath: string): Promise<number> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return raw.split("\n").filter((line) => line.trim()).length;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return 0;
    throw err;
  }
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return raw
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as T);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw err;
  }
}

export class FileStateStore {
  private readonly eventsPath: string;
  private readonly eventHashesPath: string;
  private readonly checkpointsPath: string;
  private readonly runsPath: string;
  private readonly countersPath: string;
  private readonly dlqPath: string;

  constructor(private readonly stateDir: string) {
    this.eventsPath = path.join(stateDir, "events.jsonl");
    this.eventHashesPath = path.join(stateDir, "event-hashes.json");
    this.checkpointsPath = path.join(stateDir, "checkpoints.json");
    this.runsPath = path.join(stateDir, "runs.jsonl");
    this.countersPath = path.join(stateDir, "counters.json");
    this.dlqPath = path.join(stateDir, "dlq.jsonl");
  }

  async init(): Promise<void> {
    await fs.mkdir(this.stateDir, { recursive: true });
    await Promise.all([
      fs.appendFile(this.eventsPath, ""),
      fs.appendFile(this.runsPath, ""),
      fs.appendFile(this.dlqPath, ""),
    ]);

    await readJsonFile(this.eventHashesPath, {}).then((value) => writeJsonFile(this.eventHashesPath, value));
    await readJsonFile(this.checkpointsPath, {}).then((value) => writeJsonFile(this.checkpointsPath, value));
    await readJsonFile(this.countersPath, defaultCounters()).then((value) => writeJsonFile(this.countersPath, value));
  }

  async getCheckpoint<T>(key: string, fallback: T): Promise<T> {
    const checkpoints = await readJsonFile<Record<string, unknown>>(this.checkpointsPath, {});
    return (checkpoints[key] as T | undefined) ?? fallback;
  }

  async setCheckpoint(key: string, value: unknown): Promise<void> {
    const checkpoints = await readJsonFile<Record<string, unknown>>(this.checkpointsPath, {});
    checkpoints[key] = value;
    await writeJsonFile(this.checkpointsPath, checkpoints);
  }

  async insertEvents(events: UnifiedEvent[]): Promise<InsertStats> {
    const hashes = await readJsonFile<Record<string, true>>(this.eventHashesPath, {});
    const lines: string[] = [];
    let skipped = 0;

    for (const event of events) {
      const hash = recordHash(event);
      if (hashes[hash]) {
        skipped += 1;
        continue;
      }

      hashes[hash] = true;
      lines.push(JSON.stringify({ ...event, recordHash: hash }));
    }

    if (lines.length > 0) {
      await fs.appendFile(this.eventsPath, `${lines.join("\n")}\n`, "utf-8");
      await writeJsonFile(this.eventHashesPath, hashes);
    }

    return { inserted: lines.length, skipped };
  }

  async appendRun(run: PipelineRun): Promise<void> {
    await fs.appendFile(this.runsPath, `${JSON.stringify(run)}\n`, "utf-8");
  }

  async recentRuns(limit: number): Promise<PipelineRun[]> {
    const runs = await readJsonl<PipelineRun>(this.runsPath);
    return runs.slice(-limit).reverse();
  }

  async updateCounters(update: (prev: PipelineCounters) => PipelineCounters): Promise<void> {
    const prev = await readJsonFile<PipelineCounters>(this.countersPath, defaultCounters());
    await writeJsonFile(this.countersPath, update(prev));
  }

  async pushDlq(source: string, payload: JsonObject, reason: string): Promise<void> {
    const item = {
      id: randomUUID(),
      source,
      reason,
      payload,
      createdAt: new Date().toISOString(),
    };
    await fs.appendFile(this.dlqPath, `${JSON.stringify(item)}\n`, "utf-8");
  }

  async health(): Promise<HealthState> {
    return {
      metrics: await readJsonFile<PipelineCounters>(this.countersPath, defaultCounters()),
      dlqSize: await countJsonlRows(this.dlqPath),
      stateDir: this.stateDir,
    };
  }
}
