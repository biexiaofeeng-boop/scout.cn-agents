export type Priority = "low" | "medium" | "high";
export type Confidence = "low" | "medium" | "high";
export type RiskLevel = "low" | "medium" | "high";
export type CrawlGoal = "trend_discovery" | "narrative_monitoring" | "risk_monitoring" | "actor_watch";
export type TrendType = "technology" | "event" | "actor" | "market" | "health" | "topic";
export type RuntimeProfileName = "safe_live" | "debug_fast";
export type ExpansionType =
  | "seed"
  | "seed_variant"
  | "llm_supplement"
  | "narrative_probe"
  | "analysis_probe"
  | "risk_probe"
  | "actor_probe"
  | "market_probe"
  | "audience_language"
  | "domain_constraint";
export type ReviewStatus = "approved" | "pending" | "rejected";
export type RegistryStatus = "approved" | "candidate" | "deprecated";
export type SourceType = "manual" | "rule" | "llm";
export type WatchlistTier = "watchlist-hot" | "watchlist-normal" | "discovery";
export type QueryTaskStatus = "scheduled" | "completed" | "failed";
export type TopicStatus = "draft" | "active" | "paused";
export type SeedStatus = "active" | "paused";
export type CrawlRunStatus = "planned" | "running" | "success" | "failed";
export type CrawlRunType = "backtest" | "preview" | "live";

export type TopicRegistryEntry = {
  id: string;
  name: string;
  description: string;
  status: TopicStatus;
  priority: Priority;
  platforms: string[];
  owner: string;
  seedKeywordIds: string[];
};

export type GovernanceSeed = {
  id: string;
  keywordId: string;
  topicId: string;
  keyword: string;
  normalizedKeyword: string;
  topicCluster: string;
  trendType: TrendType;
  priority: Priority;
  confidence: Confidence;
  crawlGoal: CrawlGoal;
  riskFlag: RiskLevel;
  platforms: string[];
  sourceType: SourceType;
  status: SeedStatus;
  notes?: string;
};

export type ReviewDecision = {
  expansionId: string;
  decision: ReviewStatus;
  actor: string;
  note?: string;
  decidedAt: string;
};

export type QueryUnit = {
  id: string;
  queryUnitKey: string;
  topicId: string;
  seedId: string;
  seedKeywordId: string;
  reviewedFromExpansionId?: string;
  platform: string;
  query: string;
  reviewStatus: ReviewStatus;
  enabled: boolean;
  tier: WatchlistTier;
  nextDueAt: string;
  minRevisitIntervalMinutes: number;
  retryCooldownMinutes: number;
  riskLevel: RiskLevel;
};

export type CrawlRun = {
  id: string;
  runType: CrawlRunType;
  queryUnitId?: string;
  topicId?: string;
  platform: string;
  query: string;
  plannedAt: string;
  startedAt?: string;
  endedAt?: string;
  status: CrawlRunStatus;
  recordsCollected: number;
  runner: string;
  note?: string;
};

export type SeedKeyword = {
  id: number;
  keywordId: string;
  keyword: string;
  normalizedKeyword: string;
  topicCluster: string;
  trendType: TrendType;
  priority: Priority;
  confidence: Confidence;
  suggestedPlatforms: string[];
  queryVariants: string[];
  crawlGoal: CrawlGoal;
  riskFlag: RiskLevel;
  notes: string;
};

export type ExpansionRegistryEntry = {
  id: string;
  keywordDbId: number;
  keywordId: string;
  normalizedKeyword: string;
  platform: string;
  expandedQuery: string;
  expansionType: ExpansionType;
  basedOn?: string;
  sourceType: SourceType;
  reviewStatus: ReviewStatus;
  status: RegistryStatus;
  ttlDays: number;
  expiresAt: string;
  isActive: boolean;
  notes?: string;
  lastSeenAt: string;
};

export type QueryScheduleState = {
  id: string;
  queryUnitKey: string;
  keywordDbId: number;
  keywordId: string;
  normalizedKeyword: string;
  platform: string;
  expandedQuery: string;
  tier: WatchlistTier;
  riskLevel: RiskLevel;
  minRevisitIntervalMinutes: number;
  retryCooldownMinutes: number;
  nextDueAt: string;
  lastScheduledAt?: string;
  lastSuccessAt?: string;
  lastFailedAt?: string;
  lastTaskId?: string;
  lastTaskStatus?: QueryTaskStatus;
  failureCount: number;
  isActive: boolean;
};

export type RuntimePolicy = {
  platform: string;
  profileName: RuntimeProfileName;
  perPlatformLimit: number;
  loginType: "cookie" | "qrcode";
  headless: boolean;
  enableComments: boolean;
  enableSubComments: boolean;
  maxCommentsPerNote: number;
  maxConcurrency: number;
  allowLocalStateFallback: boolean;
  maxTasksPerKeyword: number;
  maxTransientAttempts: number;
  retryBackoffSeconds: number;
  taskDelaySeconds: number;
  operatorNote: string;
};

export type PlannedCrawlTask = {
  taskId: string;
  queryUnitKey: string;
  keywordId: string;
  keyword: string;
  normalizedKeyword: string;
  topicCluster: string;
  trendType: TrendType;
  platform: string;
  expandedQuery: string;
  dedupKey: string;
  scheduledAt: string;
  policy: RuntimePolicy;
  queryStateId: string;
};

export type TrendSignal = {
  signalId: string;
  keywordId: string;
  crawlTaskId: string;
  normalizedKeyword: string;
  topicCluster: string;
  trendType: TrendType;
  signalSummary: string;
  signalEvidence: string;
  sourcePlatform: string;
  sourceUrl: string;
  trendScore: number;
  confidence: Confidence;
  riskFlag: RiskLevel;
  observedAt: string;
  freshUntil: string;
  supportCount: number;
  evidenceIds: string[];
  aggregationMethod: string;
  version: string;
};

export type BacktestReport = {
  runId: string;
  seedFile: string;
  stateDir: string;
  startedAt: string;
  completedAt: string;
  runtimeProfile: RuntimeProfileName;
  seedCount: number;
  expansionCount: number;
  approvedExpansionCount: number;
  queryStateCount: number;
  plannedTaskCountRound1: number;
  plannedTaskCountImmediateReplay: number;
  plannedTaskCountRound2: number;
  signalCount: number;
  exportedSignalCount: number;
  duePlatformsRound1: Record<string, number>;
  duePlatformsRound2: Record<string, number>;
  paths: Record<string, string>;
};
