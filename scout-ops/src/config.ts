import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

// Resolve the canonical env file with a clear precedence:
// 1. process.env.SCOUT_ENV_FILE — explicit override
// 2. scout-ops/.env — local developer override
// 3. ../scout-deploy/env/scout-ops.env — single source of truth used by docker compose
//
// Each candidate is loaded if it exists. Later ones do not overwrite already-set keys,
// so explicit overrides win.
function loadEnvFiles(cwd: string): void {
  const candidates: string[] = [];
  if (process.env.SCOUT_ENV_FILE) candidates.push(path.resolve(process.env.SCOUT_ENV_FILE));
  candidates.push(path.resolve(cwd, ".env"));
  candidates.push(path.resolve(cwd, "..", "scout-deploy", "env", "scout-ops.env"));
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        dotenv.config({ path: candidate, override: false });
      }
    } catch {
      // ignore unreadable env files; preserve existing process.env
    }
  }
}

loadEnvFiles(process.cwd());

export type Settings = {
  projectRoot: string;
  stateDir: string;
  runtimeRoot: string;
  vendorRoot: string;
  mediaCrawlerRoot: string;
  wechatRoot: string;
  wechatEnableDb: boolean;
  pipelineTickEnabled: boolean;
  opsShowPipelineViews: boolean;
  batchSize: number;
  alertDlqThreshold: number;
  schedulerIntervalSec: number;
  opsActionTimeoutMs: number;
  opsRunRetentionDays: number;
  opsRunRetentionMax: number;
  monitorHost: string;
  monitorPort: number;
  mediaCrawlerApiUrl: string;
  wechatSpiderUrl: string;
  wechatMysqlHost: string;
  wechatMysqlPort: number;
  wechatMysqlDb: string;
  wechatMysqlUser: string;
  wechatMysqlPasswd: string;
};

function toBool(v: string | undefined, defaultValue: boolean): boolean {
  if (v === undefined) return defaultValue;
  return ["1", "true", "yes", "on"].includes(v.trim().toLowerCase());
}

function toInt(v: string | undefined, defaultValue: number): number {
  if (!v) return defaultValue;
  const n = Number(v);
  return Number.isFinite(n) ? n : defaultValue;
}

export function loadSettings(cwd: string = process.cwd()): Settings {
  const projectRoot = process.env.SCOUT_PROJECT_ROOT || path.resolve(cwd, "..");
  const stateDir = path.resolve(process.env.SCOUT_STATE_DIR || path.join(projectRoot, "scout-ops", "state"));
  const runtimeRoot = path.resolve(process.env.SCOUT_RUNTIME_ROOT || path.join(projectRoot, "..", "scout"));
  const vendorRoot = path.resolve(process.env.SCOUT_VENDOR_ROOT || path.join(projectRoot, "scout-vendor"));

  const mediaCrawlerRoot = path.resolve(
    process.env.SCOUT_MEDIACRAWLER_ROOT || path.join(vendorRoot, "mediacrawler"),
  );
  const wechatRoot = path.resolve(process.env.SCOUT_WECHAT_ROOT || path.join(projectRoot, "wechat-spider"));

  return {
    projectRoot,
    stateDir,
    runtimeRoot,
    vendorRoot,
    mediaCrawlerRoot,
    wechatRoot,
    wechatEnableDb: toBool(process.env.SCOUT_WECHAT_ENABLE_DB, true),
    pipelineTickEnabled: toBool(process.env.SCOUT_PIPELINE_TICK_ENABLED, false),
    opsShowPipelineViews: toBool(process.env.SCOUT_OPS_SHOW_PIPELINE_VIEWS, false),
    batchSize: toInt(process.env.SCOUT_BATCH_SIZE, 500),
    alertDlqThreshold: toInt(process.env.SCOUT_ALERT_DLQ_THRESHOLD, 10),
    schedulerIntervalSec: toInt(process.env.SCOUT_SCHEDULER_INTERVAL_SEC, 300),
    opsActionTimeoutMs: toInt(process.env.SCOUT_OPS_ACTION_TIMEOUT_MS, 180000),
    opsRunRetentionDays: toInt(process.env.SCOUT_OPS_RUN_RETENTION_DAYS, 30),
    opsRunRetentionMax: toInt(process.env.SCOUT_OPS_RUN_RETENTION_MAX, 300),
    monitorHost: process.env.SCOUT_MONITOR_HOST || "127.0.0.1",
    monitorPort: toInt(process.env.SCOUT_MONITOR_PORT, 18080),
    mediaCrawlerApiUrl: process.env.MEDIACRAWLER_API_URL || "http://127.0.0.1:18081",
    wechatSpiderUrl: process.env.WECHAT_SPIDER_URL || "http://127.0.0.1:8080",
    wechatMysqlHost: process.env.WECHAT_MYSQL_HOST || "127.0.0.1",
    wechatMysqlPort: toInt(process.env.WECHAT_MYSQL_PORT, 3306),
    wechatMysqlDb: process.env.WECHAT_MYSQL_DB || "test",
    wechatMysqlUser: process.env.WECHAT_MYSQL_USER || "root",
    wechatMysqlPasswd: process.env.WECHAT_MYSQL_PASSWD || "",
  };
}
