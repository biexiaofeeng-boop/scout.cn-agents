import "dotenv/config";
import path from "node:path";

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
  const stateDir = path.resolve(process.env.SCOUT_STATE_DIR || path.join(projectRoot, "scout-hub", "state"));
  const runtimeRoot = path.resolve(process.env.SCOUT_RUNTIME_ROOT || "/Users/sourcefire/1data/scout");
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
    wechatMysqlHost: process.env.WECHAT_MYSQL_HOST || "127.0.0.1",
    wechatMysqlPort: toInt(process.env.WECHAT_MYSQL_PORT, 3306),
    wechatMysqlDb: process.env.WECHAT_MYSQL_DB || "test",
    wechatMysqlUser: process.env.WECHAT_MYSQL_USER || "root",
    wechatMysqlPasswd: process.env.WECHAT_MYSQL_PASSWD || "",
  };
}
