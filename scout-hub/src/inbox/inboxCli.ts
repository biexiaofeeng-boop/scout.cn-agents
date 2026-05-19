import path from "node:path";
import { archivePack, applyTaskPack, diffTaskPack } from "./inboxMerger.js";
import { loadInboxPacks } from "./inboxReader.js";
import type { Settings } from "../config.js";

export type InboxPaths = {
  inboxRoot: string;
  topicsJsonPath: string;
  seedsCsvPath: string;
};

export function resolveInboxPaths(settings: Settings): InboxPaths {
  return {
    inboxRoot: path.join(settings.runtimeRoot, "inbox"),
    topicsJsonPath: path.join(settings.projectRoot, "scout-media-agents", "config", "topics", "scout-topics.json"),
    seedsCsvPath: path.join(settings.projectRoot, "scout-media-agents", "config", "trend-seeds.csv"),
  };
}

export async function runInboxStatus(settings: Settings, log: (line: string) => void): Promise<number> {
  const paths = resolveInboxPaths(settings);
  const { packs, errors } = await loadInboxPacks(paths.inboxRoot);
  log(`inbox root: ${paths.inboxRoot}`);
  log(`packs: ${packs.length}`);
  for (const file of packs) {
    const topicsN = file.pack.topics?.length || 0;
    const seedsN = file.pack.seeds?.length || 0;
    log(`  - ${file.relative} · topics=${topicsN} · seeds=${seedsN} · projectId=${file.pack.projectId}${file.pack.intent ? ` · intent="${file.pack.intent}"` : ""}`);
  }
  if (errors.length > 0) {
    log(`errors: ${errors.length}`);
    for (const e of errors) log(`  ! ${e.path}: ${e.message}`);
  }
  return errors.length > 0 ? 1 : 0;
}

export async function runInboxPreview(settings: Settings, packRelativePath: string, log: (line: string) => void): Promise<number> {
  const paths = resolveInboxPaths(settings);
  const { packs, errors } = await loadInboxPacks(paths.inboxRoot);
  if (errors.length > 0) {
    for (const e of errors) log(`! ${e.path}: ${e.message}`);
  }
  const target = packs.find((p) => p.relative === packRelativePath || p.path.endsWith(packRelativePath));
  if (!target) {
    log(`pack not found: ${packRelativePath}`);
    log(`available:`);
    for (const p of packs) log(`  - ${p.relative}`);
    return 1;
  }
  const diff = await diffTaskPack(target.pack, paths.topicsJsonPath, paths.seedsCsvPath);
  log(`preview: ${target.relative}`);
  log(`  projectId: ${target.pack.projectId}`);
  if (target.pack.intent) log(`  intent: ${target.pack.intent}`);
  log(`  new topics: ${diff.newTopics.length}`);
  for (const t of diff.newTopics) log(`    + ${t.id} (${t.vertical}/${t.name})`);
  log(`  updated topics: ${diff.updatedTopics.length}`);
  for (const t of diff.updatedTopics) log(`    ~ ${(t.after as { id?: string }).id}`);
  log(`  new seeds: ${diff.newSeeds.length}`);
  for (const s of diff.newSeeds) log(`    + ${s.keywordId} (${s.keyword})`);
  log(`  updated seeds: ${diff.updatedSeeds.length}`);
  for (const s of diff.updatedSeeds) log(`    ~ ${s.keywordId}`);
  return 0;
}

export async function runInboxSync(settings: Settings, packRelativePath: string, log: (line: string) => void, options: { dryRun?: boolean } = {}): Promise<number> {
  const paths = resolveInboxPaths(settings);
  const { packs, errors } = await loadInboxPacks(paths.inboxRoot);
  if (errors.length > 0) {
    for (const e of errors) log(`! ${e.path}: ${e.message}`);
  }
  const target = packs.find((p) => p.relative === packRelativePath || p.path.endsWith(packRelativePath));
  if (!target) {
    log(`pack not found: ${packRelativePath}`);
    return 1;
  }
  if (options.dryRun) {
    return runInboxPreview(settings, packRelativePath, log);
  }
  const result = await applyTaskPack(target.pack, paths.topicsJsonPath, paths.seedsCsvPath);
  log(`applied ${target.relative}:`);
  log(`  topics added=${result.topicsAdded} updated=${result.topicsUpdated}`);
  log(`  seeds added=${result.seedsAdded} updated=${result.seedsUpdated}`);
  const archived = await archivePack(target.path);
  log(`archived to: ${archived}`);
  return 0;
}
