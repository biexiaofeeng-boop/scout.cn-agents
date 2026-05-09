import { ExpansionRegistryEntry, QueryScheduleState, SeedKeyword, WatchlistTier } from "./types.js";
import { addMinutes, nowIso, stableId } from "./utils.js";
import { platformToCode } from "./keywordExpansion.js";

const TIER_POLICY: Record<WatchlistTier, { defaultRevisitMinutes: number; xhsRevisitMinutes: number; defaultRetryCooldownMinutes: number; xhsRetryCooldownMinutes: number }> = {
  "watchlist-hot": {
    defaultRevisitMinutes: 12 * 60,
    xhsRevisitMinutes: 24 * 60,
    defaultRetryCooldownMinutes: 24 * 60,
    xhsRetryCooldownMinutes: 72 * 60,
  },
  "watchlist-normal": {
    defaultRevisitMinutes: 24 * 60,
    xhsRevisitMinutes: 48 * 60,
    defaultRetryCooldownMinutes: 24 * 60,
    xhsRetryCooldownMinutes: 72 * 60,
  },
  discovery: {
    defaultRevisitMinutes: 3 * 24 * 60,
    xhsRevisitMinutes: 7 * 24 * 60,
    defaultRetryCooldownMinutes: 12 * 60,
    xhsRetryCooldownMinutes: 72 * 60,
  },
};

export function inferWatchlistTier(seed: SeedKeyword): WatchlistTier {
  if (seed.crawlGoal === "risk_monitoring" || seed.priority === "high") return "watchlist-hot";
  if (seed.priority === "low") return "discovery";
  return "watchlist-normal";
}

export function buildQueryUnitKey(normalizedKeyword: string, platformCode: string, expandedQuery: string): string {
  return `${normalizedKeyword.trim().toLowerCase()}__${platformCode.trim().toLowerCase()}__${expandedQuery.trim().toLowerCase()}`;
}

export function tierIntervals(tier: WatchlistTier, platformCode: string): { revisitMinutes: number; retryCooldownMinutes: number } {
  const policy = TIER_POLICY[tier];
  const isXhs = platformCode === "xhs";
  return {
    revisitMinutes: isXhs ? policy.xhsRevisitMinutes : policy.defaultRevisitMinutes,
    retryCooldownMinutes: isXhs ? policy.xhsRetryCooldownMinutes : policy.defaultRetryCooldownMinutes,
  };
}

export function buildQueryScheduleStates(seeds: SeedKeyword[], expansions: ExpansionRegistryEntry[], now: Date): QueryScheduleState[] {
  const seedById = new Map<number, SeedKeyword>(seeds.map((seed) => [seed.id, seed]));
  const states: QueryScheduleState[] = [];

  for (const expansion of expansions) {
    if (expansion.status !== "approved" || expansion.reviewStatus !== "approved" || !expansion.isActive) continue;
    const seed = seedById.get(expansion.keywordDbId);
    if (!seed) continue;
    const platformCode = platformToCode(expansion.platform);
    const tier = inferWatchlistTier(seed);
    const { revisitMinutes, retryCooldownMinutes } = tierIntervals(tier, platformCode);
    const queryUnitKey = buildQueryUnitKey(expansion.normalizedKeyword, platformCode, expansion.expandedQuery);
    states.push({
      id: stableId("qst", queryUnitKey),
      queryUnitKey,
      keywordDbId: expansion.keywordDbId,
      keywordId: expansion.keywordId,
      normalizedKeyword: expansion.normalizedKeyword,
      platform: platformCode,
      expandedQuery: expansion.expandedQuery,
      tier,
      riskLevel: seed.riskFlag,
      minRevisitIntervalMinutes: revisitMinutes,
      retryCooldownMinutes,
      nextDueAt: nowIso(now),
      failureCount: 0,
      isActive: true,
    });
  }

  return states.sort((a, b) => a.platform.localeCompare(b.platform) || a.expandedQuery.localeCompare(b.expandedQuery));
}

export function listDueQueryStates(states: QueryScheduleState[], at: Date, platform?: string): QueryScheduleState[] {
  return states
    .filter((state) => state.isActive)
    .filter((state) => !platform || state.platform === platform)
    .filter((state) => new Date(state.nextDueAt).getTime() <= at.getTime())
    .sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime());
}

export function markScheduled(state: QueryScheduleState, taskId: string, at: Date): QueryScheduleState {
  return {
    ...state,
    lastScheduledAt: nowIso(at),
    lastTaskId: taskId,
    lastTaskStatus: "scheduled",
  };
}

export function markTaskSuccess(state: QueryScheduleState, at: Date): QueryScheduleState {
  return {
    ...state,
    lastSuccessAt: nowIso(at),
    lastTaskStatus: "completed",
    failureCount: 0,
    nextDueAt: nowIso(addMinutes(at, state.minRevisitIntervalMinutes)),
  };
}

export function markTaskFailure(state: QueryScheduleState, at: Date): QueryScheduleState {
  return {
    ...state,
    lastFailedAt: nowIso(at),
    lastTaskStatus: "failed",
    failureCount: state.failureCount + 1,
    nextDueAt: nowIso(addMinutes(at, state.retryCooldownMinutes)),
  };
}
