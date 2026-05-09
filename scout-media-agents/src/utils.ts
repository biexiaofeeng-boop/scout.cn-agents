import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export function sha1(value: string): string {
  return crypto.createHash("sha1").update(value).digest("hex");
}

export function stableId(prefix: string, value: string): string {
  return `${prefix}_${sha1(value).slice(0, 12)}`;
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

export async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function parseIso(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const out = new Date(value);
  return Number.isNaN(out.getTime()) ? undefined : out;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function uniqueStrings(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const token = value.trim();
    const key = token.toLowerCase();
    if (!token || seen.has(key)) continue;
    seen.add(key);
    out.push(token);
  }
  return out;
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function nowIso(date: Date): string {
  return date.toISOString();
}
