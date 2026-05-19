import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type { TaskPack, TaskPackFile, TaskPackError } from "./types.js";

const PACK_FILE_PATTERN = /\.ya?ml$/i;

export async function loadInboxPacks(inboxRoot: string): Promise<{ packs: TaskPackFile[]; errors: TaskPackError[] }> {
  const projectsDir = path.join(inboxRoot, "projects");
  const packs: TaskPackFile[] = [];
  const errors: TaskPackError[] = [];
  let projects: string[] = [];
  try {
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    projects = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return { packs, errors };
  }
  for (const project of projects) {
    const packDir = path.join(projectsDir, project, "task-packs");
    let files: string[] = [];
    try {
      files = await fs.readdir(packDir);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!PACK_FILE_PATTERN.test(file)) continue;
      const full = path.join(packDir, file);
      let raw = "";
      try {
        raw = await fs.readFile(full, "utf-8");
      } catch (err) {
        errors.push({ path: full, message: `read failed: ${(err as Error).message}` });
        continue;
      }
      let parsed: unknown;
      try {
        parsed = YAML.parse(raw);
      } catch (err) {
        errors.push({ path: full, message: `yaml parse failed: ${(err as Error).message}` });
        continue;
      }
      const result = validatePack(parsed, project);
      if (typeof result === "string") {
        errors.push({ path: full, message: result });
        continue;
      }
      packs.push({ path: full, relative: path.join("projects", project, "task-packs", file), pack: result });
    }
  }
  packs.sort((a, b) => a.path.localeCompare(b.path));
  return { packs, errors };
}

function validatePack(value: unknown, expectedProject: string): TaskPack | string {
  if (!value || typeof value !== "object") return "task pack must be a YAML mapping";
  const obj = value as Record<string, unknown>;
  const projectId = typeof obj.projectId === "string" ? obj.projectId : "";
  if (!projectId) return "projectId is required";
  if (projectId !== expectedProject) {
    return `projectId mismatch: file is under projects/${expectedProject}/ but pack declares projectId=${projectId}`;
  }
  const topics = Array.isArray(obj.topics) ? obj.topics : [];
  const seeds = Array.isArray(obj.seeds) ? obj.seeds : [];
  for (const t of topics) {
    if (!t || typeof t !== "object") return "every topic entry must be a mapping";
    const tt = t as Record<string, unknown>;
    if (typeof tt.id !== "string" || !tt.id) return "topic.id is required";
    if (typeof tt.name !== "string" || !tt.name) return `topic ${String(tt.id)}: name is required`;
    if (typeof tt.vertical !== "string" || !tt.vertical) return `topic ${String(tt.id)}: vertical is required`;
  }
  for (const s of seeds) {
    if (!s || typeof s !== "object") return "every seed entry must be a mapping";
    const ss = s as Record<string, unknown>;
    if (typeof ss.keywordId !== "string" || !ss.keywordId) return "seed.keywordId is required";
    if (typeof ss.keyword !== "string" || !ss.keyword) return `seed ${String(ss.keywordId)}: keyword is required`;
  }
  return {
    projectId,
    submittedBy: typeof obj.submittedBy === "string" ? obj.submittedBy : undefined,
    submittedAt: typeof obj.submittedAt === "string" ? obj.submittedAt : undefined,
    intent: typeof obj.intent === "string" ? obj.intent : undefined,
    topics: topics as TaskPack["topics"],
    seeds: seeds as TaskPack["seeds"],
  };
}
