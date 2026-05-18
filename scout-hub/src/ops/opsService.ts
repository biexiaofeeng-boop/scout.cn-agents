import fs from "node:fs/promises";
import path from "node:path";
import { ScoutPipeline } from "../pipeline.js";
import { scanTopicArtifacts } from "./runtimeScanner.js";
import type { OpsOverview, OpsProvider, OpsTopic } from "./types.js";

const PROVIDERS: Array<Omit<OpsProvider, "envState">> = [
  {
    id: "steam",
    label: "Steam Store and Reviews",
    kind: "public_endpoint",
    status: "ready",
    verticals: ["game"],
    envRequired: [],
    notes: "Store search and app reviews. Ready for first game intelligence loop.",
  },
  {
    id: "youtube",
    label: "YouTube Data API",
    kind: "official_api",
    status: "needs_key",
    verticals: ["game", "ai", "finance"],
    envRequired: ["YOUTUBE_API_KEY"],
    notes: "Requires YouTube Data API key before live collection.",
  },
  {
    id: "reddit",
    label: "Reddit Public Search",
    kind: "public_endpoint",
    status: "ready",
    verticals: ["game", "finance", "ai"],
    envRequired: [],
    notes: "Public JSON search first; OAuth can be added later.",
  },
  {
    id: "mediacrawler",
    label: "MediaCrawler CN Platforms",
    kind: "vendor_crawler",
    status: "ready",
    verticals: ["game", "ai", "consumer", "finance"],
    envRequired: [],
    notes: "CN social crawler; account/session and anti-bot risk must be operated manually.",
  },
  {
    id: "wechat-spider",
    label: "WeChat Spider",
    kind: "vendor_crawler",
    status: "ready",
    verticals: ["game", "ai", "consumer", "finance"],
    envRequired: ["WECHAT_MYSQL_PASSWD"],
    notes: "Operational through Docker stack; physical move under scout-vendor is deferred.",
  },
];

export class OpsService {
  constructor(private readonly pipeline: ScoutPipeline) {}

  async buildOverview(): Promise<OpsOverview> {
    const topicConfigPath = path.join(this.pipeline.settings.projectRoot, "scout-media-agents", "config", "topics", "scout-topics.json");
    const runtimeRoot = this.pipeline.settings.runtimeRoot;
    const topics = await this.loadTopics(topicConfigPath);
    const topicArtifacts = await Promise.all(topics.map((topic) => scanTopicArtifacts(runtimeRoot, topic.vertical, topic.id)));
    const topicRows = topics.map((topic, index) => ({ ...topic, artifacts: topicArtifacts[index] }));
    const hubHealth = await this.pipeline.currentHealth();
    const recentRuns = await this.pipeline.store.recentRuns(12);
    const alerts = this.buildAlerts(hubHealth);
    const providers = this.providersWithEnvState();

    return {
      generatedAt: new Date().toISOString(),
      projectRoot: this.pipeline.settings.projectRoot,
      runtimeRoot,
      topicConfigPath,
      hubHealth,
      alerts,
      providers,
      topics: topicRows,
      recentRuns,
      summary: {
        topicCount: topicRows.length,
        activeTopicCount: topicRows.filter((topic) => topic.status === "active").length,
        providerCount: providers.length,
        readyProviderCount: providers.filter((provider) => provider.status === "ready" && provider.envState !== "missing").length,
        topicsWithHandoff: topicRows.filter((topic) => topic.artifacts.gameLensHandoffExists).length,
        topicsWithReport: topicRows.filter((topic) => topic.artifacts.reportExists).length,
        rawRecordCount: topicRows.reduce((sum, topic) => sum + topic.artifacts.rawRecordCount, 0),
        normalizedEvidenceCount: topicRows.reduce((sum, topic) => sum + topic.artifacts.normalizedRecordCount, 0),
      },
    };
  }

  private async loadTopics(topicConfigPath: string): Promise<OpsTopic[]> {
    try {
      const raw = await fs.readFile(topicConfigPath, "utf-8");
      const parsed = JSON.parse(raw) as OpsTopic[];
      return parsed.map((topic) => ({
        id: String(topic.id || ""),
        name: String(topic.name || topic.id || ""),
        description: String(topic.description || ""),
        status: String(topic.status || "unknown"),
        priority: String(topic.priority || "medium"),
        vertical: String(topic.vertical || "general"),
        market: String(topic.market || ""),
        language: String(topic.language || ""),
        intent: String(topic.intent || ""),
        refreshCadence: String(topic.refreshCadence || ""),
        platforms: Array.isArray(topic.platforms) ? topic.platforms.map(String) : [],
        dataSources: Array.isArray(topic.dataSources) ? topic.dataSources.map(String) : [],
        owner: String(topic.owner || ""),
        seedKeywordIds: Array.isArray(topic.seedKeywordIds) ? topic.seedKeywordIds.map(String) : [],
      }));
    } catch {
      return [];
    }
  }

  private providersWithEnvState(): OpsProvider[] {
    return PROVIDERS.map((provider) => {
      const missing = provider.envRequired.filter((key) => !process.env[key]);
      return {
        ...provider,
        envState: provider.envRequired.length === 0 ? "not_required" : missing.length === 0 ? "ready" : "missing",
      };
    });
  }

  private buildAlerts(health: Awaited<ReturnType<ScoutPipeline["currentHealth"]>>): Array<{ level: string; code: string; message: string }> {
    const alerts: Array<{ level: string; code: string; message: string }> = [];
    if (health.dlqSize >= this.pipeline.settings.alertDlqThreshold) {
      alerts.push({
        level: "warning",
        code: "DLQ_THRESHOLD",
        message: `DLQ size=${health.dlqSize}, threshold=${this.pipeline.settings.alertDlqThreshold}`,
      });
    }
    if (health.metrics.runsFailed > 0) {
      alerts.push({
        level: "warning",
        code: "PIPELINE_FAILURE",
        message: `pipeline failures observed=${health.metrics.runsFailed}`,
      });
    }
    return alerts;
  }
}
