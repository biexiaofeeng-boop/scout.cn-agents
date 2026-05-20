// Task pack ingestion: project-side teams drop YAML files under
// scout/inbox/projects/<projectId>/task-packs/*.yaml to register new
// topics + seeds without touching the scout-lab repo directly. The
// scout-ops `inbox` CLI reads them, validates the schema, previews
// the diff against scout-media-agents config, and (on sync) merges
// the topic into scout-topics.json and seeds into trend-seeds.csv,
// then archives the pack into _synced/ so it isn't re-applied.

export type TaskPackTopic = {
  id: string;
  name: string;
  vertical: string;
  market?: string;
  language?: string;
  description?: string;
  priority?: string;
  intent?: string;
  refreshCadence?: string;
  platforms?: string[];
  dataSources?: string[];
  owner?: string;
  seedKeywordIds?: string[];
  status?: string;
};

export type TaskPackSeed = {
  keywordId: string;
  keyword: string;
  normalizedKeyword?: string;
  topicCluster?: string;
  trendType?: string;
  priority?: string;
  confidence?: string;
  suggestedPlatforms?: string[];
  queryVariants?: string[];
  crawlGoal?: string;
  riskFlag?: string;
  notes?: string;
};

export type TaskPack = {
  projectId: string;
  submittedBy?: string;
  submittedAt?: string;
  intent?: string;
  topics?: TaskPackTopic[];
  seeds?: TaskPackSeed[];
};

export type TaskPackFile = {
  path: string;
  relative: string;
  pack: TaskPack;
};

export type TaskPackError = {
  path: string;
  message: string;
};

export type TaskPackDiff = {
  pack: TaskPack;
  newTopics: TaskPackTopic[];
  updatedTopics: { before: Record<string, unknown>; after: Record<string, unknown> }[];
  newSeeds: TaskPackSeed[];
  updatedSeeds: { keywordId: string; before: string; after: string }[];
};
