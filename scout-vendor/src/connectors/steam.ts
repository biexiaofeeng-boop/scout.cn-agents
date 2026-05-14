import type { CollectionRequest, VendorEvidenceRecord } from "../types.js";
import { nowIso, stableId } from "../utils.js";

type SteamReview = {
  recommendationid?: string;
  author?: { steamid?: string; playtime_forever?: number };
  review?: string;
  timestamp_created?: number;
  voted_up?: boolean;
  votes_up?: number;
  weighted_vote_score?: string;
};

type SteamReviewsResponse = {
  success?: number;
  reviews?: SteamReview[];
};

type SteamSearchItem = {
  id?: number;
  name?: string;
  tiny_image?: string;
};

type SteamSearchResponse = {
  items?: SteamSearchItem[];
};

export async function collectSteam(request: CollectionRequest): Promise<VendorEvidenceRecord[]> {
  return request.appId ? collectSteamReviews(request) : collectSteamSearch(request);
}

async function collectSteamReviews(request: CollectionRequest): Promise<VendorEvidenceRecord[]> {
  const url = new URL(`https://store.steampowered.com/appreviews/${encodeURIComponent(request.appId || "")}`);
  url.searchParams.set("json", "1");
  url.searchParams.set("num_per_page", String(request.limit));
  url.searchParams.set("language", request.language.startsWith("en") ? "english" : "all");
  url.searchParams.set("filter", "recent");

  const payload = await fetchJson<SteamReviewsResponse>(url.toString());
  const collectedAt = nowIso();
  return (payload.reviews || []).slice(0, request.limit).map((review, index) => ({
    id: stableId("ev_steam_review", review.recommendationid || JSON.stringify(review), index),
    provider: "steam",
    source: "steam_review",
    topicId: request.topicId,
    vertical: request.vertical,
    query: request.query,
    title: `Steam review for app ${request.appId}`,
    text: review.review || "",
    url: `https://store.steampowered.com/app/${request.appId}`,
    author: review.author?.steamid,
    publishedAt: review.timestamp_created ? new Date(review.timestamp_created * 1000).toISOString() : undefined,
    collectedAt,
    market: request.market,
    language: request.language,
    metrics: {
      votedUp: review.voted_up ?? false,
      votesUp: review.votes_up ?? 0,
      weightedVoteScore: Number(review.weighted_vote_score || 0),
      playtimeForever: review.author?.playtime_forever || 0,
    },
    rawPayload: { review },
  }));
}

async function collectSteamSearch(request: CollectionRequest): Promise<VendorEvidenceRecord[]> {
  const url = new URL("https://store.steampowered.com/api/storesearch/");
  url.searchParams.set("term", request.query);
  url.searchParams.set("cc", request.market.toLowerCase());
  url.searchParams.set("l", request.language.startsWith("en") ? "en" : request.language);

  const payload = await fetchJson<SteamSearchResponse>(url.toString());
  const collectedAt = nowIso();
  return (payload.items || []).slice(0, request.limit).map((item, index) => ({
    id: stableId("ev_steam_game", `${item.id || ""}:${item.name || ""}`, index),
    provider: "steam",
    source: "steam_store_search",
    topicId: request.topicId,
    vertical: request.vertical,
    query: request.query,
    title: item.name || `Steam result ${index + 1}`,
    text: `Steam store search result for "${request.query}".`,
    url: item.id ? `https://store.steampowered.com/app/${item.id}` : undefined,
    collectedAt,
    market: request.market,
    language: request.language,
    metrics: { appId: item.id || 0 },
    rawPayload: { item },
  }));
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { "User-Agent": "ScoutVendor/0.1" } });
  if (!response.ok) throw new Error(`Steam request failed status=${response.status}`);
  return response.json() as Promise<T>;
}
