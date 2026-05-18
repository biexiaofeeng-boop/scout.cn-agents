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
