import path from "node:path";
import { collectReddit } from "./connectors/reddit.js";
import { collectSteam } from "./connectors/steam.js";
import { collectYouTube } from "./connectors/youtube.js";
import { getProvider } from "./providers.js";
import type { CollectionRequest, CollectionResult, VendorEvidenceRecord } from "./types.js";
import { buildRunId, defaultRuntimeRoot, sanitizePathToken, writeJson, writeJsonl } from "./utils.js";

export async function collect(request: CollectionRequest, runtimeRoot = defaultRuntimeRoot()): Promise<CollectionResult> {
  const provider = getProvider(request.provider);
  if (!provider) throw new Error(`Unknown provider: ${request.provider}`);

  const runId = buildRunId(provider.id);
  const records = request.dryRun ? [buildDryRunRecord(request, runId)] : await collectRecords(request);
  const outDir = path.join(
    runtimeRoot,
    "topics",
    sanitizePathToken(request.vertical),
    sanitizePathToken(request.topicId),
    "raw",
    sanitizePathToken(request.provider),
  );
  const outputPath = path.join(outDir, `${runId}.jsonl`);
  const manifestPath = path.join(outDir, `${runId}.manifest.json`);

  await writeJsonl(outputPath, records);
  await writeJson(manifestPath, {
    runId,
    request,
    recordCount: records.length,
    outputPath,
    provider,
  });

  return { runId, request, records, outputPath, manifestPath };
}

async function collectRecords(request: CollectionRequest): Promise<VendorEvidenceRecord[]> {
  if (request.provider === "steam") return collectSteam(request);
  if (request.provider === "youtube") return collectYouTube(request);
  if (request.provider === "reddit") return collectReddit(request);
  throw new Error(`Provider ${request.provider} is registered but has no connector implementation yet`);
}

function buildDryRunRecord(request: CollectionRequest, runId: string): VendorEvidenceRecord {
  const collectedAt = new Date().toISOString();
  return {
    id: `dry_${runId}`,
    provider: request.provider,
    source: "dry_run",
    topicId: request.topicId,
    vertical: request.vertical,
    query: request.query,
    title: `Dry run for ${request.provider}`,
    text: `Would collect ${request.limit} records for query "${request.query}".`,
    collectedAt,
    market: request.market,
    language: request.language,
    metrics: { limit: request.limit },
    rawPayload: { request },
  };
}
