import type { CollectionRequest, VendorEvidenceRecord } from "../types.js";
import { nowIso, stableId } from "../utils.js";

type RedditChild = {
  data?: {
    id?: string;
    title?: string;
    selftext?: string;
    permalink?: string;
    author?: string;
    created_utc?: number;
    score?: number;
    num_comments?: number;
    subreddit?: string;
    url?: string;
  };
};

type RedditResponse = {
  data?: { children?: RedditChild[] };
};

export async function collectReddit(request: CollectionRequest): Promise<VendorEvidenceRecord[]> {
  const url = request.subreddit
    ? new URL(`https://www.reddit.com/r/${encodeURIComponent(request.subreddit)}/search.json`)
    : new URL("https://www.reddit.com/search.json");
  url.searchParams.set("q", request.query);
  url.searchParams.set("limit", String(Math.min(request.limit, 25)));
  url.searchParams.set("sort", "relevance");
  if (request.subreddit) url.searchParams.set("restrict_sr", "1");

  const response = await fetch(url.toString(), { headers: { "User-Agent": "ScoutVendor/0.1" } });
  if (!response.ok) throw new Error(`Reddit request failed status=${response.status}`);
  const payload = (await response.json()) as RedditResponse;
  const collectedAt = nowIso();

  return (payload.data?.children || []).slice(0, request.limit).map((child, index) => {
    const item = child.data || {};
    return {
      id: stableId("ev_reddit", item.id || JSON.stringify(item), index),
      provider: "reddit",
      source: "reddit_search",
      topicId: request.topicId,
      vertical: request.vertical,
      query: request.query,
      title: item.title || `Reddit result ${index + 1}`,
      text: item.selftext || item.title || "",
      url: item.permalink ? `https://www.reddit.com${item.permalink}` : item.url,
      author: item.author,
      publishedAt: item.created_utc ? new Date(item.created_utc * 1000).toISOString() : undefined,
      collectedAt,
      market: request.market,
      language: request.language,
      metrics: {
        score: item.score || 0,
        comments: item.num_comments || 0,
      },
      rawPayload: { item },
    };
  });
}
