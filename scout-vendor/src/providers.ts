import type { DataProvider } from "./types.js";

export const DATA_PROVIDERS: DataProvider[] = [
  {
    id: "steam",
    label: "Steam Store and Reviews",
    kind: "public_endpoint",
    status: "ready",
    verticals: ["game"],
    envRequired: [],
    outputSchema: "vendor_evidence_v1",
    notes: "Supports app reviews by appId and lightweight store search by query.",
  },
  {
    id: "youtube",
    label: "YouTube Data API",
    kind: "official_api",
    status: "needs_key",
    verticals: ["game", "ai", "finance"],
    envRequired: ["YOUTUBE_API_KEY"],
    outputSchema: "vendor_evidence_v1",
    notes: "Use official search endpoint first; comments/transcripts can be added after quota policy is clear.",
  },
  {
    id: "reddit",
    label: "Reddit Public Search",
    kind: "public_endpoint",
    status: "ready",
    verticals: ["game", "finance", "ai"],
    envRequired: [],
    outputSchema: "vendor_evidence_v1",
    notes: "Starts with public search JSON; can move to OAuth/PRAW-style connector later.",
  },
  {
    id: "mediacrawler",
    label: "MediaCrawler CN Platforms",
    kind: "vendor_crawler",
    status: "ready",
    verticals: ["game", "ai", "consumer", "finance"],
    envRequired: [],
    outputSchema: "vendor_evidence_v1",
    notes: "Existing Chinese platforms: xhs, dy, bili, weibo, zhihu, tieba, kuaishou.",
  },
  {
    id: "wechat-spider",
    label: "WeChat Spider",
    kind: "vendor_crawler",
    status: "ready",
    verticals: ["game", "ai", "consumer", "finance"],
    envRequired: ["WECHAT_MYSQL_PASSWD"],
    outputSchema: "vendor_evidence_v1",
    notes: "Keep current runtime path for now; govern it from scout-vendor/provider registry before moving files.",
  },
];

export function getProvider(id: string): DataProvider | undefined {
  return DATA_PROVIDERS.find((provider) => provider.id === id);
}
