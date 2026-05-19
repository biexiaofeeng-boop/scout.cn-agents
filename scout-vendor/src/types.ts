export type ProviderKind = "official_api" | "public_endpoint" | "vendor_crawler" | "manual_import";
export type ProviderStatus = "ready" | "needs_key" | "manual_first" | "planned";

export type DataProvider = {
  id: string;
  label: string;
  kind: ProviderKind;
  status: ProviderStatus;
  verticals: string[];
  envRequired: string[];
  outputSchema: "vendor_evidence_v1";
  notes: string;
};

export type CollectionRequest = {
  provider: string;
  topicId: string;
  vertical: string;
  query: string;
  market: string;
  language: string;
  limit: number;
  appId?: string;
  subreddit?: string;
  mediaCrawlerRoot?: string;
  dryRun?: boolean;
};

export type VendorEvidenceRecord = {
  id: string;
  provider: string;
  source: string;
  topicId: string;
  vertical: string;
  query: string;
  title: string;
  text: string;
  url?: string;
  author?: string;
  publishedAt?: string;
  collectedAt: string;
  market: string;
  language: string;
  metrics: Record<string, string | number | boolean>;
  rawPayload: Record<string, unknown>;
};

export type CollectionResult = {
  runId: string;
  request: CollectionRequest;
  records: VendorEvidenceRecord[];
  outputPath?: string;
  manifestPath?: string;
};
