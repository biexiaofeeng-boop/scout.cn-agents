import fs from "node:fs/promises";
import path from "node:path";
import type { OpsArtifactState } from "./types.js";

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function statMtime(filePath: string): Promise<string> {
  try {
    const stat = await fs.stat(filePath);
    return stat.mtime.toISOString();
  } catch {
    return "";
  }
}

async function countJsonlRows(filePath: string): Promise<number> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return raw.split("\n").filter((line) => line.trim()).length;
  } catch {
    return 0;
  }
}

async function readJson(filePath: string): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function listFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...await listFiles(fullPath));
      if (entry.isFile()) files.push(fullPath);
    }
    return files;
  } catch {
    return [];
  }
}

export async function scanTopicArtifacts(runtimeRoot: string, vertical: string, topicId: string): Promise<OpsArtifactState> {
  const topicDir = path.join(runtimeRoot, "topics", vertical, topicId);
  const rawDir = path.join(topicDir, "raw");
  const rawFiles = (await listFiles(rawDir)).filter((file) => file.endsWith(".jsonl"));
  const rawRecordCounts = await Promise.all(rawFiles.map((file) => countJsonlRows(file)));
  const rawProviderNames = new Set(rawFiles.map((file) => path.relative(rawDir, file).split(path.sep)[0]).filter(Boolean));
  const rawStats = await Promise.all(rawFiles.map((file) => statMtime(file)));
  const lastRawUpdatedAt = rawStats.filter(Boolean).sort().at(-1) || "";

  const normalizedPath = path.join(topicDir, "normalized", "evidence.jsonl");
  const normalizedManifestPath = path.join(topicDir, "normalized", "evidence.manifest.json");
  const gameLensHandoffPath = path.join(topicDir, "handoff", "gamelens", "evidence.json");
  const reportPath = path.join(topicDir, "reports", "latest.md");
  const handoffPayload = await readJson(gameLensHandoffPath);

  return {
    topicId,
    vertical,
    topicDir,
    rawProviderCount: rawProviderNames.size,
    rawFileCount: rawFiles.length,
    rawRecordCount: rawRecordCounts.reduce((sum, count) => sum + count, 0),
    normalizedPath,
    normalizedExists: await exists(normalizedPath),
    normalizedRecordCount: await countJsonlRows(normalizedPath),
    normalizedManifestPath,
    normalizedManifestExists: await exists(normalizedManifestPath),
    gameLensHandoffPath,
    gameLensHandoffExists: await exists(gameLensHandoffPath),
    gameLensEvidenceCount: Number(handoffPayload.evidenceCount || 0),
    reportPath,
    reportExists: await exists(reportPath),
    reportUpdatedAt: await statMtime(reportPath),
    lastRawUpdatedAt,
  };
}
