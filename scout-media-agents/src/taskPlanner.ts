import { PlannedCrawlTask, QueryScheduleState, RuntimeProfileName, RuntimePolicy, SeedKeyword } from "./types.js";
import { resolveRuntimePolicy } from "./runtimePolicy.js";
import { listDueQueryStates, markScheduled } from "./queryScheduleState.js";
import { nowIso, stableId } from "./utils.js";

export type PlanResult = {
  tasks: PlannedCrawlTask[];
  states: QueryScheduleState[];
};

const PRIORITY_WEIGHT: Record<SeedKeyword["priority"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

type DueGroup = {
  keywordId: string;
  priority: number;
  items: QueryScheduleState[];
  lastScheduledAt?: string;
};

function groupDueStates(
  dueStates: QueryScheduleState[],
  seedByKeywordId: Map<string, SeedKeyword>,
): DueGroup[] {
  const groups = new Map<string, DueGroup>();
  for (const state of dueStates) {
    const seed = seedByKeywordId.get(state.keywordId);
    const priority = seed ? PRIORITY_WEIGHT[seed.priority] : PRIORITY_WEIGHT.medium;
    const existing = groups.get(state.keywordId);
    if (existing) {
      existing.items.push(state);
      continue;
    }
    groups.set(state.keywordId, {
      keywordId: state.keywordId,
      priority,
      items: [state],
      lastScheduledAt: state.lastScheduledAt,
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      lastScheduledAt: group.items.reduce<string | undefined>((latest, item) => {
        if (!item.lastScheduledAt) return latest;
        if (!latest) return item.lastScheduledAt;
        return new Date(item.lastScheduledAt).getTime() > new Date(latest).getTime() ? item.lastScheduledAt : latest;
      }, group.lastScheduledAt),
      items: group.items.sort((a, b) => {
        const dueDelta = new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime();
        if (dueDelta !== 0) return dueDelta;
        return a.expandedQuery.localeCompare(b.expandedQuery);
      }),
    }))
    .sort((a, b) => {
      if (!a.lastScheduledAt && b.lastScheduledAt) return -1;
      if (a.lastScheduledAt && !b.lastScheduledAt) return 1;
      if (a.lastScheduledAt && b.lastScheduledAt) {
        const lastScheduledDelta = new Date(a.lastScheduledAt).getTime() - new Date(b.lastScheduledAt).getTime();
        if (lastScheduledDelta !== 0) return lastScheduledDelta;
      }
      if (b.priority !== a.priority) return b.priority - a.priority;
      const aDue = new Date(a.items[0]?.nextDueAt || 0).getTime();
      const bDue = new Date(b.items[0]?.nextDueAt || 0).getTime();
      if (aDue !== bDue) return aDue - bDue;
      return a.keywordId.localeCompare(b.keywordId);
    });
}

function selectPlatformStates(
  dueStates: QueryScheduleState[],
  seedByKeywordId: Map<string, SeedKeyword>,
  policy: RuntimePolicy,
): QueryScheduleState[] {
  const groups = groupDueStates(dueStates, seedByKeywordId);
  const selections: QueryScheduleState[] = [];
  const selectedPerKeyword = new Map<string, number>();

  while (selections.length < policy.perPlatformLimit) {
    let advanced = false;
    for (const group of groups) {
      if (selections.length >= policy.perPlatformLimit) break;
      const used = selectedPerKeyword.get(group.keywordId) || 0;
      if (used >= policy.maxTasksPerKeyword) continue;
      const next = group.items.shift();
      if (!next) continue;
      selections.push(next);
      selectedPerKeyword.set(group.keywordId, used + 1);
      advanced = true;
    }
    if (!advanced) break;
  }

  return selections;
}

export function planDueTasks(
  seeds: SeedKeyword[],
  states: QueryScheduleState[],
  at: Date,
  runtimeProfile: RuntimeProfileName,
): PlanResult {
  const nextStates = [...states];
  const seedByKeywordId = new Map<string, SeedKeyword>(seeds.map((seed) => [seed.keywordId, seed]));
  const tasks: PlannedCrawlTask[] = [];

  const platforms = [...new Set(states.map((state) => state.platform))].sort();
  for (const platform of platforms) {
    const policy = resolveRuntimePolicy(platform, runtimeProfile);
    const due = selectPlatformStates(listDueQueryStates(nextStates, at, platform), seedByKeywordId, policy);
    for (const state of due) {
      const seed = seedByKeywordId.get(state.keywordId);
      if (!seed) continue;
      const taskId = stableId("task", `${state.queryUnitKey}::${at.toISOString()}`);
      const dedupKey = stableId("dedup", state.queryUnitKey);
      tasks.push({
        taskId,
        queryUnitKey: state.queryUnitKey,
        keywordId: state.keywordId,
        keyword: seed.keyword,
        normalizedKeyword: seed.normalizedKeyword,
        topicCluster: seed.topicCluster,
        trendType: seed.trendType,
        platform,
        expandedQuery: state.expandedQuery,
        dedupKey,
        scheduledAt: nowIso(at),
        policy,
        queryStateId: state.id,
      });
      const index = nextStates.findIndex((item) => item.id === state.id);
      if (index >= 0) nextStates[index] = markScheduled(nextStates[index], taskId, at);
    }
  }

  return { tasks, states: nextStates };
}

export function countTasksByPlatform(tasks: PlannedCrawlTask[]): Record<string, number> {
  return tasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.platform] = (acc[task.platform] || 0) + 1;
    return acc;
  }, {});
}
