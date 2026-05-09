import fs from "node:fs/promises";
import path from "node:path";
import { splitExecutionSources, LlmSupplementsByKeyword } from "./keywordExpansion.js";
import { SeedKeyword } from "./types.js";
import { uniqueStrings } from "./utils.js";

type PromptMetadata = {
  platform: string;
  promptKey: string;
  selectionMode: string;
  promptPath: string;
};

type LlmConfig = {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

export type LlmExpansionSnapshot = {
  enabled: boolean;
  model: string;
  baseUrl: string;
  promptSelector: Record<string, PromptMetadata>;
  supplements: LlmSupplementsByKeyword;
};

const PLATFORM_PROMPT_FILES: Record<string, string> = {
  xiaohongshu: "xiaohongshu.md",
  douyin: "douyin.md",
  bilibili: "bilibili.md",
  weibo: "weibo.md",
};

const KEYWORD_EXPANSION_USER_TEMPLATE = `原始关键词: {originalKeyword}
归一化主题: {normalizedKeyword}
主题簇: {topicCluster}
趋势类型: {trendType}
抓取目标: {crawlGoal}
平台: {platform}
风险等级: {riskFlag}
优先级: {priority}
置信度: {confidence}
已有变体: {existingVariants}

请只补充 1-2 个适合该平台抓取的新增搜索词。
要求：
1. 面向中文世界情报监控，不要泛化成空泛大词。
2. 尽量贴近平台语境和用户真实搜索表达。
3. 结果应能直接作为站内搜索词。
4. 严格返回 JSON，不要附加解释。

返回格式：
{"expanded_keywords":["搜索词1","搜索词2"]}`;

function fallbackSystemPrompt(platform: string): string {
  return [
    "你是一个中文世界情报监控系统的关键词扩展助手。",
    `当前目标平台是 ${platform}。`,
    "你的任务是基于原始主题，只补充少量更适合平台站内搜索的新增查询词。",
    "输出必须克制、具体、可执行，优先补充事件别称、平台化说法、追踪型查询。",
    "禁止输出过宽泛、与主题弱相关、无法直接用于搜索的词。",
    "只能返回 JSON：{\"expanded_keywords\":[\"词1\",\"词2\"]}",
  ].join("");
}

function loadConfig(): LlmConfig {
  const apiKey = (process.env.SCOUT_MEDIA_LLM_API_KEY || "").trim();
  const baseUrl = (process.env.SCOUT_MEDIA_LLM_BASE_URL || "https://api.openai.com/v1").trim();
  const model = (process.env.SCOUT_MEDIA_LLM_MODEL || "gpt-4o-mini").trim();
  const timeoutMs = Number(process.env.SCOUT_MEDIA_LLM_TIMEOUT_MS || "30000");
  return {
    enabled: apiKey.length > 0,
    apiKey,
    baseUrl,
    model,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000,
  };
}

async function loadSystemPrompt(projectRoot: string, platform: string): Promise<{ prompt: string; metadata: PromptMetadata }> {
  const normalizedPlatform = platform.trim().toLowerCase();
  const promptDir = path.join(projectRoot, "config", "prompts");
  const promptFile = PLATFORM_PROMPT_FILES[normalizedPlatform];
  const fallbackPath = path.join(promptDir, "default.md");
  const candidatePath = promptFile ? path.join(promptDir, promptFile) : fallbackPath;

  try {
    const prompt = (await fs.readFile(candidatePath, "utf-8")).trim();
    if (prompt) {
      return {
        prompt,
        metadata: {
          platform: normalizedPlatform,
          promptKey: promptFile ? normalizedPlatform : "default",
          selectionMode: promptFile ? "platform_specific" : "default",
          promptPath: candidatePath,
        },
      };
    }
  } catch {
    // fall through to builtin fallback
  }

  return {
    prompt: fallbackSystemPrompt(normalizedPlatform || "default"),
    metadata: {
      platform: normalizedPlatform || "default",
      promptKey: "default",
      selectionMode: "builtin_fallback",
      promptPath: candidatePath,
    },
  };
}

function buildUserPrompt(seed: SeedKeyword, platform: string): string {
  return KEYWORD_EXPANSION_USER_TEMPLATE
    .replace("{originalKeyword}", seed.keyword)
    .replace("{normalizedKeyword}", seed.normalizedKeyword)
    .replace("{topicCluster}", seed.topicCluster || "general")
    .replace("{trendType}", seed.trendType)
    .replace("{crawlGoal}", seed.crawlGoal)
    .replace("{platform}", platform)
    .replace("{riskFlag}", seed.riskFlag)
    .replace("{priority}", seed.priority)
    .replace("{confidence}", seed.confidence)
    .replace("{existingVariants}", JSON.stringify(seed.queryVariants));
}

function normalizeContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  const firstNewline = trimmed.indexOf("\n");
  const withoutFence = firstNewline >= 0 ? trimmed.slice(firstNewline + 1) : trimmed;
  return withoutFence.replace(/```$/u, "").trim();
}

function extractMessageContent(response: ChatCompletionResponse): string {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => item.text || "")
      .join("")
      .trim();
  }
  return "";
}

function parseExpandedKeywords(rawContent: string): string[] {
  try {
    const normalized = normalizeContent(rawContent);
    const parsed = JSON.parse(normalized) as { expanded_keywords?: unknown };
    if (!Array.isArray(parsed.expanded_keywords)) return [];
    return uniqueStrings(parsed.expanded_keywords.map((value) => String(value ?? "").trim())).slice(0, 2);
  } catch {
    return [];
  }
}

async function requestExpandedKeywords(
  config: LlmConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string[]> {
  if (!config.enabled) return [];

  const baseUrl = config.baseUrl.endsWith("/") ? config.baseUrl : `${config.baseUrl}/`;
  const endpoint = new URL("chat/completions", baseUrl).toString();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`LLM request failed status=${response.status}`);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  return parseExpandedKeywords(extractMessageContent(payload));
}

export async function collectLlmSupplements(
  projectRoot: string,
  seeds: SeedKeyword[],
): Promise<LlmExpansionSnapshot> {
  const config = loadConfig();
  const promptSelector: Record<string, PromptMetadata> = {};
  const supplements: LlmSupplementsByKeyword = {};

  if (!config.enabled) {
    return {
      enabled: false,
      model: config.model,
      baseUrl: config.baseUrl,
      promptSelector,
      supplements,
    };
  }

  for (const seed of seeds) {
    const { crawlTargets } = splitExecutionSources(seed.suggestedPlatforms);
    for (const platform of crawlTargets) {
      const promptStateKey = `${seed.keywordId}::${platform}`;
      const { prompt, metadata } = await loadSystemPrompt(projectRoot, platform);
      promptSelector[promptStateKey] = metadata;

      try {
        const expandedKeywords = await requestExpandedKeywords(
          config,
          prompt,
          buildUserPrompt(seed, platform),
        );
        if (!expandedKeywords.length) continue;
        supplements[seed.keywordId] ||= {};
        supplements[seed.keywordId][platform] = expandedKeywords;
      } catch {
        // Keep rule-only fallback for this platform.
      }
    }
  }

  return {
    enabled: true,
    model: config.model,
    baseUrl: config.baseUrl,
    promptSelector,
    supplements,
  };
}
