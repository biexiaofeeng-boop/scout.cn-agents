import { createHash } from "node:crypto";

export type UnifiedEvent = {
  source: "mediacrawler" | "wechat-spider";
  sourceId: string;
  platform: string;
  eventType: "content" | "comment" | "dynamic";
  accountId: string;
  accountName: string;
  contentId: string;
  title: string;
  body: string;
  url: string;
  publishedAt: string;
  collectedAt: string;
  metrics: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
};

export type RunStatus = "success" | "partial_failed" | "failed";

export type PipelineRun = {
  runId: string;
  startedAt: string;
  endedAt: string;
  status: RunStatus;
  processedCount: number;
  failedCount: number;
  errorText?: string;
};

export type PipelineCounters = {
  runsTotal: number;
  runsFailed: number;
  eventsInserted: number;
  eventsSkipped: number;
  recordsFailed: number;
  lastRunAt: string;
};

export function recordHash(event: UnifiedEvent): string {
  const canonical = JSON.stringify(
    {
      source: event.source,
      sourceId: event.sourceId,
      platform: event.platform,
      eventType: event.eventType,
      accountId: event.accountId,
      contentId: event.contentId,
      title: event.title,
      body: event.body,
      url: event.url,
      publishedAt: event.publishedAt,
    },
    Object.keys({
      source: 1,
      sourceId: 1,
      platform: 1,
      eventType: 1,
      accountId: 1,
      contentId: 1,
      title: 1,
      body: 1,
      url: 1,
      publishedAt: 1,
    }).sort(),
  );
  return createHash("sha256").update(canonical).digest("hex");
}

export function defaultCounters(): PipelineCounters {
  return {
    runsTotal: 0,
    runsFailed: 0,
    eventsInserted: 0,
    eventsSkipped: 0,
    recordsFailed: 0,
    lastRunAt: "",
  };
}
