import fs from "node:fs/promises";
import type { OpsProvider, OpsTopic } from "./types.js";

export const OPS_PROVIDERS: Array<Omit<OpsProvider, "envState">> = [
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

export const OPS_COLLECTABLE_PROVIDER_IDS = ["steam", "youtube", "reddit"] as const;

export async function loadOpsTopics(topicConfigPath: string): Promise<OpsTopic[]> {
  try {
    const raw = await fs.readFile(topicConfigPath, "utf-8");
    const parsed = JSON.parse(raw) as OpsTopic[];
    return parsed.map((topic) => ({
      id: String(topic.id || ""),
      projectId: String(topic.projectId || ""),
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

export function providersWithEnvState(): OpsProvider[] {
  return OPS_PROVIDERS.map((provider) => {
    const missing = provider.envRequired.filter((key) => !process.env[key]);
    return {
      ...provider,
      envState: provider.envRequired.length === 0 ? "not_required" : missing.length === 0 ? "ready" : "missing",
    };
  });
}
