import type { PipelineRun } from "../models.js";

export type OpsProviderStatus = "ready" | "needs_key" | "manual_first" | "planned";

export type OpsProvider = {
  id: string;
  label: string;
  kind: string;
  status: OpsProviderStatus;
  verticals: string[];
  envRequired: string[];
  envState: "ready" | "missing" | "not_required";
  notes: string;
};

export type OpsTopic = {
  id: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  vertical: string;
  market: string;
  language: string;
  intent: string;
  refreshCadence: string;
  platforms: string[];
  dataSources: string[];
  owner: string;
  seedKeywordIds: string[];
};

export type OpsActionName = "collect-topic" | "normalize-topic" | "collect-and-normalize-topic";

export type OpsActionRunStatus = "running" | "success" | "partial_failed" | "failed";

export type OpsActionRunSummary = {
  runId: string;
  action: OpsActionName;
  status: OpsActionRunStatus;
  topicId: string;
  vertical: string;
  providers: string[];
  dryRun: boolean;
  startedAt: string;
  endedAt: string;
  runDir: string;
  reportPath: string;
  rawRecordCount: number;
  normalizedEvidenceCount: number;
  errorText?: string;
};

export type OpsActionRun = OpsActionRunSummary & {
  query: string;
  limit: number;
  commandCount: number;
  successfulCommandCount: number;
  failedCommandCount: number;
  itemPath: string;
  logPath: string;
  summaryPath: string;
};

export type OpsArtifactState = {
  topicId: string;
  vertical: string;
  topicDir: string;
  rawProviderCount: number;
  rawFileCount: number;
  rawRecordCount: number;
  normalizedPath: string;
  normalizedExists: boolean;
  normalizedRecordCount: number;
  normalizedManifestPath: string;
  normalizedManifestExists: boolean;
  gameLensHandoffPath: string;
  gameLensHandoffExists: boolean;
  gameLensEvidenceCount: number;
  reportPath: string;
  reportExists: boolean;
  reportUpdatedAt: string;
  lastRawUpdatedAt: string;
};

export type OpsOverview = {
  generatedAt: string;
  projectRoot: string;
  runtimeRoot: string;
  topicConfigPath: string;
  hubHealth: unknown;
  alerts: Array<{ level: string; code: string; message: string }>;
  providers: OpsProvider[];
  topics: Array<OpsTopic & { artifacts: OpsArtifactState }>;
  recentRuns: PipelineRun[];
  recentOpsRuns: OpsActionRunSummary[];
  summary: {
    topicCount: number;
    activeTopicCount: number;
    providerCount: number;
    readyProviderCount: number;
    topicsWithHandoff: number;
    topicsWithReport: number;
    rawRecordCount: number;
    normalizedEvidenceCount: number;
  };
};
