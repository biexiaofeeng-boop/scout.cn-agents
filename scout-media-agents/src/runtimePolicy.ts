import { RuntimePolicy, RuntimeProfileName } from "./types.js";

type PolicyTemplate = Omit<RuntimePolicy, "platform" | "profileName">;

type PolicyProfile = {
  default: PolicyTemplate;
  platforms?: Record<string, Partial<PolicyTemplate>>;
};

const PROFILES: Record<RuntimeProfileName, PolicyProfile> = {
  safe_live: {
    default: {
      perPlatformLimit: 2,
      loginType: "cookie",
      headless: false,
      enableComments: false,
      enableSubComments: false,
      maxCommentsPerNote: 3,
      maxConcurrency: 1,
      allowLocalStateFallback: false,
      maxTasksPerKeyword: 2,
      maxTransientAttempts: 1,
      retryBackoffSeconds: 0,
      taskDelaySeconds: 10,
      operatorNote: "Use minimal verified live runs only.",
    },
    platforms: {
      xhs: {
        perPlatformLimit: 1,
        taskDelaySeconds: 20,
        operatorNote: "Treat xhs as sparse manual verification only.",
      },
      dy: {
        perPlatformLimit: 2,
        maxTransientAttempts: 2,
        retryBackoffSeconds: 20,
        operatorNote: "Prefer dy for repeated runtime verification before widening coverage.",
      },
      bili: {
        perPlatformLimit: 2,
        maxTransientAttempts: 2,
        retryBackoffSeconds: 15,
        operatorNote: "bili is one of the lower-risk repeat verification paths.",
      },
      wb: {
        perPlatformLimit: 2,
        taskDelaySeconds: 8,
        operatorNote: "Use wb for rapid narrative shifts and response tracking.",
      },
      steam: {
        perPlatformLimit: 3,
        headless: true,
        taskDelaySeconds: 2,
        operatorNote: "Steam uses public endpoints; prefer reviews and store search for game intelligence.",
      },
      youtube: {
        perPlatformLimit: 3,
        headless: true,
        taskDelaySeconds: 2,
        operatorNote: "YouTube should use official Data API with quota-aware collection.",
      },
      reddit: {
        perPlatformLimit: 3,
        headless: true,
        taskDelaySeconds: 2,
        operatorNote: "Reddit starts with public search and can move to OAuth/PRAW when needed.",
      },
    },
  },
  debug_fast: {
    default: {
      perPlatformLimit: 3,
      loginType: "cookie",
      headless: true,
      enableComments: false,
      enableSubComments: false,
      maxCommentsPerNote: 2,
      maxConcurrency: 1,
      allowLocalStateFallback: true,
      maxTasksPerKeyword: 3,
      maxTransientAttempts: 2,
      retryBackoffSeconds: 3,
      taskDelaySeconds: 0,
      operatorNote: "Use only for local debugging and replay.",
    },
  },
};

export function resolveRuntimePolicy(platform: string, profileName: RuntimeProfileName = "safe_live"): RuntimePolicy {
  const profile = PROFILES[profileName];
  const overrides = profile.platforms?.[platform] || {};
  return {
    ...profile.default,
    ...overrides,
    platform,
    profileName,
  };
}
