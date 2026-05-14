import type { CollectionRequest, VendorEvidenceRecord } from "../types.js";
import { nowIso, stableId } from "../utils.js";

type YouTubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    publishedAt?: string;
  };
};

type YouTubeSearchResponse = {
  items?: YouTubeSearchItem[];
};

export async function collectYouTube(request: CollectionRequest): Promise<VendorEvidenceRecord[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY is required for youtube provider");
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(Math.min(request.limit, 25)));
  url.searchParams.set("q", request.query);
  url.searchParams.set("relevanceLanguage", request.language.slice(0, 2));
  url.searchParams.set("regionCode", request.market.slice(0, 2).toUpperCase());

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`YouTube request failed status=${response.status}`);
  const payload = (await response.json()) as YouTubeSearchResponse;
  const collectedAt = nowIso();

  return (payload.items || []).slice(0, request.limit).map((item, index) => {
    const videoId = item.id?.videoId || "";
    return {
      id: stableId("ev_youtube", videoId || JSON.stringify(item), index),
      provider: "youtube",
      source: "youtube_search",
      topicId: request.topicId,
      vertical: request.vertical,
      query: request.query,
      title: item.snippet?.title || `YouTube result ${index + 1}`,
      text: item.snippet?.description || item.snippet?.title || "",
      url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined,
      author: item.snippet?.channelTitle,
      publishedAt: item.snippet?.publishedAt,
      collectedAt,
      market: request.market,
      language: request.language,
      metrics: {},
      rawPayload: { item },
    };
  });
}
