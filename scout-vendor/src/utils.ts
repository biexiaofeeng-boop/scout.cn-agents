import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export function sha1(value: string): string {
  return crypto.createHash("sha1").update(value).digest("hex");
}

export function stableId(prefix: string, value: string, index = 0): string {
  return `${prefix}_${sha1(`${value}:${index}`).slice(0, 12)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function defaultRuntimeRoot(): string {
  return process.env.SCOUT_RUNTIME_ROOT || "/Users/sourcefire/1data/scout";
}

export async function writeJsonl(filePath: string, rows: unknown[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf-8");
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf-8");
}

export function sanitizePathToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

export function buildRunId(provider: string): string {
  return `${sanitizePathToken(provider)}_${new Date().toISOString().replaceAll(/[:.]/g, "-")}_${crypto.randomUUID().slice(0, 8)}`;
}
