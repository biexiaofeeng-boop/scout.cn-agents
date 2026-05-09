import fs from "node:fs/promises";
import path from "node:path";
import { buildExpansionRegistry, platformToCode } from "./keywordExpansion.js";
import { buildQueryScheduleStates, buildQueryUnitKey } from "./queryScheduleState.js";
import { defaultSeedFile, loadSeedRegistry } from "./seedRegistry.js";
import { countTasksByPlatform, planDueTasks } from "./taskPlanner.js";
import {
  BacktestReport,
  CrawlRun,
  CrawlRunStatus,
  ExpansionRegistryEntry,
  GovernanceSeed,
  QueryUnit,
  ReviewDecision,
  ReviewStatus,
  RuntimeProfileName,
  SeedKeyword,
  TopicRegistryEntry,
} from "./types.js";
import { ensureDir, nowIso, readJson, stableId, writeJson } from "./utils.js";

export type GovernanceContext = {
  projectRoot: string;
  seedFile: string;
  stateDir: string;
  loadedAt: string;
  topics: TopicRegistryEntry[];
  rawSeeds: SeedKeyword[];
  seeds: GovernanceSeed[];
  reviewDecisions: ReviewDecision[];
  expansions: ExpansionRegistryEntry[];
  queryUnits: QueryUnit[];
};

export type GovernanceLoadOptions = {
  projectRoot: string;
  seedFile?: string;
  stateDir?: string;
  now?: Date;
};

const TOPICS_FILE = ["config", "topics", "scout-topics.json"];
const REVIEW_DECISIONS_FILE = ["registries", "review-decisions.json"];
const RUN_REGISTRY_FILE = ["runs", "run-registry.json"];
const SNAPSHOT_TOPICS_FILE = ["registries", "topics.snapshot.json"];
const SNAPSHOT_SEEDS_FILE = ["registries", "seeds.snapshot.json"];
const SNAPSHOT_EXPANSIONS_FILE = ["registries", "review.snapshot.json"];
const SNAPSHOT_QUERY_UNITS_FILE = ["registries", "query-units.snapshot.json"];

function resolveUnder(root: string, parts: string[]): string {
  return path.join(root, ...parts);
}

export function defaultGovernanceStateDir(projectRoot: string): string {
  return path.join(projectRoot, "state");
}

async function ensureJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  const current = await readJson<T>(filePath, fallback);
  await writeJson(filePath, current);
  return current;
}

export async function ensureGovernanceState(stateDir: string): Promise<void> {
  await ensureDir(resolveUnder(stateDir, ["registries"]));
  await ensureDir(resolveUnder(stateDir, ["runs"]));
  await ensureDir(resolveUnder(stateDir, ["backtests"]));
  await ensureJsonFile(resolveUnder(stateDir, REVIEW_DECISIONS_FILE), [] as ReviewDecision[]);
  await ensureJsonFile(resolveUnder(stateDir, RUN_REGISTRY_FILE), [] as CrawlRun[]);
}

export async function loadTopics(projectRoot: string): Promise<TopicRegistryEntry[]> {
  return readJson<TopicRegistryEntry[]>(resolveUnder(projectRoot, TOPICS_FILE), []);
}

function buildGovernanceSeeds(rawSeeds: SeedKeyword[], topics: TopicRegistryEntry[]): GovernanceSeed[] {
  const topicByKeywordId = new Map<string, TopicRegistryEntry>();
  for (const topic of topics) {
    for (const keywordId of topic.seedKeywordIds) {
      topicByKeywordId.set(keywordId, topic);
    }
  }

  return rawSeeds.map((seed) => {
    const topic = topicByKeywordId.get(seed.keywordId);
    return {
      id: stableId("seed", seed.keywordId),
      keywordId: seed.keywordId,
      topicId: topic?.id || stableId("topic", seed.topicCluster),
      keyword: seed.keyword,
      normalizedKeyword: seed.normalizedKeyword,
      topicCluster: seed.topicCluster,
      trendType: seed.trendType,
      priority: seed.priority,
      confidence: seed.confidence,
      crawlGoal: seed.crawlGoal,
      riskFlag: seed.riskFlag,
      platforms: [...seed.suggestedPlatforms],
      sourceType: "manual",
      status: "active",
      notes: seed.notes,
    };
  });
}

function reduceLatestDecision(decisions: ReviewDecision[]): Map<string, ReviewDecision> {
  return decisions.reduce<Map<string, ReviewDecision>>((acc, decision) => {
    const current = acc.get(decision.expansionId);
    if (!current || new Date(current.decidedAt).getTime() <= new Date(decision.decidedAt).getTime()) {
      acc.set(decision.expansionId, decision);
    }
    return acc;
  }, new Map<string, ReviewDecision>());
}

export function applyReviewDecisions<T extends { id: string; reviewStatus: ReviewStatus; status: string }>(
  entries: T[],
  decisions: ReviewDecision[],
): T[] {
  const latestDecisionById = reduceLatestDecision(decisions);
  return entries.map((entry) => {
    const decision = latestDecisionById.get(entry.id);
    if (!decision) return entry;
    const nextStatus = decision.decision === "approved" ? "approved" : decision.decision === "rejected" ? "deprecated" : "candidate";
    return {
      ...entry,
      reviewStatus: decision.decision,
      status: nextStatus,
    };
  });
}

function buildRawSeedsFromGovernanceSeeds(seeds: GovernanceSeed[]): SeedKeyword[] {
  return seeds.map((seed, index) => ({
    id: index + 1,
    keywordId: seed.keywordId,
    keyword: seed.keyword,
    normalizedKeyword: seed.normalizedKeyword,
    topicCluster: seed.topicCluster,
    trendType: seed.trendType,
    priority: seed.priority,
    confidence: seed.confidence,
    suggestedPlatforms: seed.platforms,
    queryVariants: [],
    crawlGoal: seed.crawlGoal,
    riskFlag: seed.riskFlag,
    notes: seed.notes || "",
  }));
}

function buildQueryUnits(
  seeds: GovernanceSeed[],
  expansions: ExpansionRegistryEntry[],
): QueryUnit[] {
  const governanceSeedByKeywordId = new Map<string, GovernanceSeed>(seeds.map((seed) => [seed.keywordId, seed]));
  const states = buildQueryScheduleStates(buildRawSeedsFromGovernanceSeeds(seeds), expansions, new Date());
  const expansionByQueryKey = new Map(expansions.map((entry) => [buildQueryUnitKey(entry.normalizedKeyword, platformToCode(entry.platform), entry.expandedQuery), entry]));

  return states.map((state) => {
    const seed = governanceSeedByKeywordId.get(state.keywordId);
    const expansion = expansionByQueryKey.get(state.queryUnitKey);
    return {
      id: stableId("qry", state.queryUnitKey),
      queryUnitKey: state.queryUnitKey,
      topicId: seed?.topicId || stableId("topic", state.normalizedKeyword),
      seedId: seed?.id || stableId("seed", state.keywordId),
      seedKeywordId: state.keywordId,
      reviewedFromExpansionId: expansion?.id,
      platform: state.platform,
      query: state.expandedQuery,
      reviewStatus: expansion?.reviewStatus || "approved",
      enabled: state.isActive,
      tier: state.tier,
      nextDueAt: state.nextDueAt,
      minRevisitIntervalMinutes: state.minRevisitIntervalMinutes,
      retryCooldownMinutes: state.retryCooldownMinutes,
      riskLevel: state.riskLevel,
    };
  });
}

export async function syncGovernanceSnapshots(context: GovernanceContext): Promise<void> {
  await writeJson(resolveUnder(context.stateDir, SNAPSHOT_TOPICS_FILE), context.topics);
  await writeJson(resolveUnder(context.stateDir, SNAPSHOT_SEEDS_FILE), context.seeds);
  await writeJson(resolveUnder(context.stateDir, SNAPSHOT_EXPANSIONS_FILE), context.expansions);
  await writeJson(resolveUnder(context.stateDir, SNAPSHOT_QUERY_UNITS_FILE), context.queryUnits);
}

export async function loadGovernanceContext(options: GovernanceLoadOptions): Promise<GovernanceContext> {
  const now = options.now || new Date();
  const projectRoot = path.resolve(options.projectRoot);
  const seedFile = options.seedFile ? path.resolve(options.seedFile) : defaultSeedFile(projectRoot);
  const stateDir = options.stateDir ? path.resolve(options.stateDir) : defaultGovernanceStateDir(projectRoot);

  await ensureGovernanceState(stateDir);

  const topics = await loadTopics(projectRoot);
  const rawSeeds = await loadSeedRegistry(seedFile);
  const seeds = buildGovernanceSeeds(rawSeeds, topics);
  const reviewDecisions = await readJson<ReviewDecision[]>(resolveUnder(stateDir, REVIEW_DECISIONS_FILE), []);
  const expansions = applyReviewDecisions(buildExpansionRegistry(rawSeeds, now), reviewDecisions);
  const queryUnits = buildQueryUnits(seeds, expansions);

  const context: GovernanceContext = {
    projectRoot,
    seedFile,
    stateDir,
    loadedAt: nowIso(now),
    topics,
    rawSeeds,
    seeds,
    reviewDecisions,
    expansions,
    queryUnits,
  };

  await syncGovernanceSnapshots(context);
  return context;
}

export function listTopicSummaries(context: GovernanceContext): Array<Record<string, unknown>> {
  return context.topics.map((topic) => {
    const seeds = context.seeds.filter((seed) => seed.topicId === topic.id);
    const queryUnits = context.queryUnits.filter((unit) => unit.topicId === topic.id);
    const pendingReviews = context.expansions.filter((expansion) => {
      if (expansion.reviewStatus !== "pending") return false;
      const seed = context.seeds.find((item) => item.keywordId === expansion.keywordId);
      return seed?.topicId === topic.id;
    }).length;

    return {
      id: topic.id,
      name: topic.name,
      status: topic.status,
      priority: topic.priority,
      owner: topic.owner,
      seedCount: seeds.length,
      approvedQueryUnitCount: queryUnits.length,
      pendingReviewCount: pendingReviews,
      platforms: topic.platforms,
    };
  });
}

export function listReviewEntries(
  context: GovernanceContext,
  status?: ReviewStatus,
): Array<Record<string, unknown>> {
  const topicById = new Map(context.topics.map((topic) => [topic.id, topic]));
  const latestDecisionById = reduceLatestDecision(context.reviewDecisions);

  return context.expansions
    .filter((entry) => !status || entry.reviewStatus === status)
    .map((entry) => {
      const seed = context.seeds.find((item) => item.keywordId === entry.keywordId);
      const topic = seed ? topicById.get(seed.topicId) : undefined;
      const decision = latestDecisionById.get(entry.id);
      return {
        id: entry.id,
        topicId: topic?.id,
        topicName: topic?.name,
        keywordId: entry.keywordId,
        platform: platformToCode(entry.platform),
        query: entry.expandedQuery,
        expansionType: entry.expansionType,
        sourceType: entry.sourceType,
        reviewStatus: entry.reviewStatus,
        registryStatus: entry.status,
        lastDecisionAt: decision?.decidedAt,
        lastDecisionNote: decision?.note,
      };
    })
    .sort((a, b) => String(a.reviewStatus).localeCompare(String(b.reviewStatus)) || String(a.platform).localeCompare(String(b.platform)) || String(a.query).localeCompare(String(b.query)));
}

export async function approveReviewEntry(
  context: GovernanceContext,
  expansionId: string,
  actor: string,
  note?: string,
): Promise<ReviewDecision> {
  const entry = context.expansions.find((item) => item.id === expansionId);
  if (!entry) {
    throw new Error(`Unknown expansion id: ${expansionId}`);
  }

  const nextDecision: ReviewDecision = {
    expansionId,
    decision: "approved",
    actor,
    note,
    decidedAt: nowIso(new Date()),
  };

  const retained = context.reviewDecisions.filter((item) => item.expansionId !== expansionId);
  retained.push(nextDecision);
  await writeJson(resolveUnder(context.stateDir, REVIEW_DECISIONS_FILE), retained);
  return nextDecision;
}

export function planNextTasks(
  context: GovernanceContext,
  runtimeProfile: RuntimeProfileName,
  limit?: number,
): Record<string, unknown> {
  const plannedAt = new Date();
  const queryStates = buildQueryScheduleStates(context.rawSeeds, context.expansions, plannedAt);
  const plan = planDueTasks(context.rawSeeds, queryStates, plannedAt, runtimeProfile);
  const topicById = new Map(context.topics.map((topic) => [topic.id, topic]));
  const seedByKeywordId = new Map(context.seeds.map((seed) => [seed.keywordId, seed]));
  const queryUnitByKey = new Map(context.queryUnits.map((unit) => [unit.queryUnitKey, unit]));
  const selectedTasks = typeof limit === "number" ? plan.tasks.slice(0, Math.max(limit, 0)) : plan.tasks;

  return {
    plannedAt: nowIso(plannedAt),
    runtimeProfile,
    totalPlanned: plan.tasks.length,
    returnedCount: selectedTasks.length,
    perPlatformCounts: countTasksByPlatform(plan.tasks),
    items: selectedTasks.map((task) => {
      const seed = seedByKeywordId.get(task.keywordId);
      const queryUnit = queryUnitByKey.get(task.queryUnitKey);
      const topic = seed ? topicById.get(seed.topicId) : undefined;
      return {
        taskId: task.taskId,
        topicId: topic?.id,
        topicName: topic?.name,
        keywordId: task.keywordId,
        keyword: task.keyword,
        platform: task.platform,
        query: task.expandedQuery,
        tier: queryUnit?.tier,
        riskLevel: queryUnit?.riskLevel,
        nextDueAt: queryUnit?.nextDueAt,
        scheduledAt: task.scheduledAt,
      };
    }),
  };
}

function toRunStatus(report: BacktestReport): CrawlRunStatus {
  return report.plannedTaskCountRound1 >= 0 ? "success" : "failed";
}

async function loadBacktestRuns(backtestsDir: string): Promise<CrawlRun[]> {
  try {
    const items = await fs.readdir(backtestsDir, { withFileTypes: true });
    const runs: Array<CrawlRun | undefined> = await Promise.all(
      items.filter((item) => item.isDirectory()).map(async (item) => {
        const reportFile = path.join(backtestsDir, item.name, "reports", "backtest-report.json");
        try {
          const report = await readJson<BacktestReport | null>(reportFile, null);
          if (!report) return undefined;
          return {
            id: report.runId,
            runType: "backtest",
            queryUnitId: undefined,
            topicId: undefined,
            platform: Object.keys(report.duePlatformsRound1).join(","),
            query: path.basename(report.seedFile),
            plannedAt: report.startedAt,
            startedAt: report.startedAt,
            endedAt: report.completedAt,
            status: toRunStatus(report),
            recordsCollected: report.signalCount,
            runner: "backtest",
            note: `round1=${report.plannedTaskCountRound1}; round2=${report.plannedTaskCountRound2}`,
          } satisfies CrawlRun;
        } catch {
          return undefined;
        }
      }),
    );

    return runs.filter((item): item is CrawlRun => item !== undefined);
  } catch {
    return [];
  }
}

export async function listRuns(context: GovernanceContext, limit?: number): Promise<Record<string, unknown>> {
  const registryRuns = await readJson<CrawlRun[]>(resolveUnder(context.stateDir, RUN_REGISTRY_FILE), []);
  const backtestRuns = await loadBacktestRuns(path.join(context.stateDir, "backtests"));
  const items = [...registryRuns, ...backtestRuns].sort(
    (a, b) => new Date(b.startedAt || b.plannedAt).getTime() - new Date(a.startedAt || a.plannedAt).getTime(),
  );

  return {
    total: items.length,
    returnedCount: typeof limit === "number" ? Math.min(limit, items.length) : items.length,
    items: typeof limit === "number" ? items.slice(0, Math.max(limit, 0)) : items,
  };
}
