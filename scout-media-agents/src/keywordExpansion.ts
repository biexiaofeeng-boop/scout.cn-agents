import { ExpansionRegistryEntry, RiskLevel, SeedKeyword } from "./types.js";
import { addDays, nowIso, stableId, uniqueStrings } from "./utils.js";

export type LlmSupplementsByKeyword = Record<string, Record<string, string[]>>;

export const PLATFORM_LABEL_TO_CODE: Record<string, string> = {
  xiaohongshu: "xhs",
  xhs: "xhs",
  douyin: "dy",
  dy: "dy",
  bilibili: "bili",
  bili: "bili",
  weibo: "wb",
  wb: "wb",
  kuaishou: "ks",
  ks: "ks",
  tieba: "tieba",
  zhihu: "zhihu",
  steam: "steam",
  youtube: "youtube",
  reddit: "reddit",
};

export const PLATFORM_CODE_TO_LABEL: Record<string, string> = {
  xhs: "xiaohongshu",
  dy: "douyin",
  bili: "bilibili",
  wb: "weibo",
  ks: "kuaishou",
  tieba: "tieba",
  zhihu: "zhihu",
  steam: "steam",
  youtube: "youtube",
  reddit: "reddit",
};

const REFERENCE_SOURCES = new Set(["industry_news", "news_search", "google_trends"]);

const GOAL_SUFFIXES: Record<string, Record<string, Array<[ExpansionRegistryEntry["expansionType"], string]>>> = {
  trend_discovery: {
    xiaohongshu: [["narrative_probe", "趋势"], ["audience_language", "讨论"]],
    douyin: [["narrative_probe", "热议"], ["audience_language", "解读"]],
    bilibili: [["analysis_probe", "解读"], ["analysis_probe", "分析"]],
    weibo: [["narrative_probe", "热搜"], ["narrative_probe", "发酵"]],
    steam: [["analysis_probe", "reviews"], ["audience_language", "discussion"]],
    youtube: [["analysis_probe", "gameplay"], ["audience_language", "reaction"]],
    reddit: [["audience_language", "discussion"], ["risk_probe", "complaints"]],
  },
  narrative_monitoring: {
    xiaohongshu: [["audience_language", "观点"], ["audience_language", "分享"]],
    douyin: [["audience_language", "说法"], ["narrative_probe", "热议"]],
    bilibili: [["analysis_probe", "评论"], ["analysis_probe", "观察"]],
    weibo: [["narrative_probe", "回应"], ["narrative_probe", "观点"]],
    steam: [["audience_language", "review"], ["risk_probe", "negative reviews"]],
    youtube: [["audience_language", "comments"], ["analysis_probe", "review"]],
    reddit: [["audience_language", "player discussion"], ["risk_probe", "complaints"]],
  },
  risk_monitoring: {
    xiaohongshu: [["risk_probe", "争议"], ["risk_probe", "避雷"]],
    douyin: [["risk_probe", "翻车"], ["risk_probe", "争议"]],
    bilibili: [["risk_probe", "复盘"], ["risk_probe", "争议"]],
    weibo: [["risk_probe", "回应"], ["risk_probe", "争议"]],
  },
  actor_watch: {
    xiaohongshu: [["actor_probe", "观点"], ["actor_probe", "发声"]],
    douyin: [["actor_probe", "回应"], ["actor_probe", "直播"]],
    bilibili: [["actor_probe", "解读"], ["actor_probe", "发言"]],
    weibo: [["actor_probe", "回应"], ["actor_probe", "表态"]],
  },
};

const TREND_TYPE_SUFFIXES: Record<string, Record<string, Array<[ExpansionRegistryEntry["expansionType"], string]>>> = {
  technology: {
    xiaohongshu: [["domain_constraint", "工具"], ["domain_constraint", "工作流"]],
    douyin: [["domain_constraint", "实操"], ["domain_constraint", "效率"]],
    bilibili: [["analysis_probe", "教程"], ["analysis_probe", "测评"]],
    weibo: [["narrative_probe", "动向"], ["narrative_probe", "发布"]],
  },
  event: {
    xiaohongshu: [["narrative_probe", "最新"], ["narrative_probe", "现场"]],
    douyin: [["narrative_probe", "进展"], ["narrative_probe", "战况"]],
    bilibili: [["analysis_probe", "复盘"], ["analysis_probe", "分析"]],
    weibo: [["narrative_probe", "快讯"], ["narrative_probe", "回应"]],
  },
  actor: {
    xiaohongshu: [["actor_probe", "观点"], ["actor_probe", "动向"]],
    douyin: [["actor_probe", "发言"], ["actor_probe", "回应"]],
    bilibili: [["analysis_probe", "人物"], ["analysis_probe", "观察"]],
    weibo: [["actor_probe", "表态"], ["actor_probe", "回应"]],
  },
  market: {
    xiaohongshu: [["market_probe", "消费"], ["market_probe", "推荐"]],
    douyin: [["market_probe", "销量"], ["market_probe", "趋势"]],
    bilibili: [["analysis_probe", "市场"], ["analysis_probe", "盘点"]],
    weibo: [["market_probe", "热度"], ["market_probe", "行业"]],
    steam: [["market_probe", "similar games"], ["market_probe", "reviews"]],
    youtube: [["market_probe", "trailer"], ["market_probe", "gameplay"]],
    reddit: [["market_probe", "recommendations"], ["market_probe", "similar games"]],
  },
  health: {
    xiaohongshu: [["domain_constraint", "成分"], ["risk_probe", "风险"]],
    douyin: [["domain_constraint", "功效"], ["risk_probe", "争议"]],
    bilibili: [["analysis_probe", "科普"], ["risk_probe", "避坑"]],
    weibo: [["narrative_probe", "热议"], ["risk_probe", "争议"]],
  },
  topic: {
    xiaohongshu: [["narrative_probe", "讨论"], ["audience_language", "分享"]],
    douyin: [["narrative_probe", "热议"], ["audience_language", "解读"]],
    bilibili: [["analysis_probe", "分析"], ["analysis_probe", "观察"]],
    weibo: [["narrative_probe", "热搜"], ["narrative_probe", "观点"]],
  },
};

export function normalizePlatformLabel(platform: string): string {
  const token = platform.trim().toLowerCase();
  if (PLATFORM_CODE_TO_LABEL[token]) return PLATFORM_CODE_TO_LABEL[token];
  return token;
}

export function platformToCode(platform: string): string {
  const token = normalizePlatformLabel(platform);
  return PLATFORM_LABEL_TO_CODE[token] || token;
}

function parsePlatformTokens(platforms: string[]): string[] {
  return uniqueStrings(platforms.map((platform) => normalizePlatformLabel(platform)));
}

export function splitExecutionSources(platforms: string[]): {
  crawlTargets: string[];
  referenceSources: string[];
  unsupportedSources: string[];
} {
  const crawlTargets: string[] = [];
  const referenceSources: string[] = [];
  const unsupportedSources: string[] = [];

  for (const token of parsePlatformTokens(platforms)) {
    if (REFERENCE_SOURCES.has(token)) {
      referenceSources.push(token);
    } else if (PLATFORM_LABEL_TO_CODE[token]) {
      crawlTargets.push(token);
    } else {
      unsupportedSources.push(token);
    }
  }

  return { crawlTargets, referenceSources, unsupportedSources };
}

function needsReview(seed: SeedKeyword): boolean {
  return seed.riskFlag === "high" || seed.confidence !== "high";
}

function ttlDaysForRisk(riskFlag: RiskLevel): number {
  if (riskFlag === "high") return 14;
  if (riskFlag === "medium") return 21;
  return 30;
}

function buildBaseQueries(seed: SeedKeyword): Array<{ query: string; type: ExpansionRegistryEntry["expansionType"]; basedOn: string }> {
  const base: Array<{ query: string; type: ExpansionRegistryEntry["expansionType"]; basedOn: string }> = [
    { query: seed.keyword, type: "seed", basedOn: seed.keyword },
  ];
  if (seed.normalizedKeyword.toLowerCase() !== seed.keyword.toLowerCase()) {
    base.push({ query: seed.normalizedKeyword, type: "seed_variant", basedOn: seed.normalizedKeyword });
  }
  for (const variant of seed.queryVariants) {
    const lowered = variant.toLowerCase();
    if (lowered === seed.keyword.toLowerCase() || lowered === seed.normalizedKeyword.toLowerCase()) continue;
    base.push({ query: variant, type: "seed_variant", basedOn: variant });
  }
  return base;
}

function buildRuleQueries(seed: SeedKeyword, platform: string): Array<{ query: string; type: ExpansionRegistryEntry["expansionType"]; basedOn: string }> {
  const items: Array<{ query: string; type: ExpansionRegistryEntry["expansionType"]; basedOn: string }> = [];
  const goalRows = GOAL_SUFFIXES[seed.crawlGoal]?.[platform] || [];
  const typeRows = TREND_TYPE_SUFFIXES[seed.trendType]?.[platform] || [];
  for (const [type, suffix] of [...goalRows, ...typeRows]) {
    items.push({ query: `${seed.normalizedKeyword} ${suffix}`.trim(), type, basedOn: seed.normalizedKeyword });
  }
  return items;
}

function buildLlmQueries(
  seed: SeedKeyword,
  platform: string,
  llmSupplements: LlmSupplementsByKeyword | undefined,
): Array<{ query: string; type: ExpansionRegistryEntry["expansionType"]; basedOn: string }> {
  const values = llmSupplements?.[seed.keywordId]?.[platform] || [];
  return uniqueStrings(values).map((query) => ({
    query,
    type: "llm_supplement",
    basedOn: seed.normalizedKeyword,
  }));
}

export function buildExpansionRegistry(
  seeds: SeedKeyword[],
  now: Date,
  llmSupplements?: LlmSupplementsByKeyword,
): ExpansionRegistryEntry[] {
  const entries = new Map<string, ExpansionRegistryEntry>();

  for (const seed of seeds) {
    const { crawlTargets } = splitExecutionSources(seed.suggestedPlatforms);
    const reviewRequired = needsReview(seed);
    const ttlDays = ttlDaysForRisk(seed.riskFlag);

    for (const platform of crawlTargets) {
      const baseQueries = buildBaseQueries(seed);
      const ruleQueries = buildRuleQueries(seed, platform);
      const llmQueries = buildLlmQueries(seed, platform, llmSupplements);
      for (const item of [...baseQueries, ...ruleQueries, ...llmQueries]) {
        const isLlmDerived = item.type === "llm_supplement";
        const isRuleDerived = item.type !== "seed" && item.type !== "seed_variant" && !isLlmDerived;
        const reviewStatus = isLlmDerived
          ? "pending"
          : reviewRequired && isRuleDerived
            ? "pending"
            : "approved";
        const status = isLlmDerived
          ? "candidate"
          : reviewRequired && isRuleDerived
            ? "candidate"
            : "approved";
        const entryKey = [seed.keywordId, platform, item.query.toLowerCase()].join("::");
        entries.set(entryKey, {
          id: stableId("exp", entryKey),
          keywordDbId: seed.id,
          keywordId: seed.keywordId,
          normalizedKeyword: seed.normalizedKeyword,
          platform,
          expandedQuery: item.query,
          expansionType: item.type,
          basedOn: item.basedOn,
          sourceType: isLlmDerived ? "llm" : isRuleDerived ? "rule" : "manual",
          reviewStatus,
          status,
          ttlDays,
          expiresAt: nowIso(addDays(now, ttlDays)),
          isActive: true,
          notes: seed.notes || undefined,
          lastSeenAt: nowIso(now),
        });
      }
    }
  }

  return [...entries.values()].sort((a, b) => a.platform.localeCompare(b.platform) || a.expandedQuery.localeCompare(b.expandedQuery));
}
