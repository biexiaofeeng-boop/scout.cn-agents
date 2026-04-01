import "dotenv/config";
import path from "node:path";

export type Settings = {
  projectRoot: string;
  stateDir: string;
  mediaCrawlerRoot: string;
  wechatRoot: string;
  wechatEnableDb: boolean;
  batchSize: number;
  alertDlqThreshold: number;
  schedulerIntervalSec: number;
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

  const mediaCrawlerRoot = path.resolve(
    process.env.SCOUT_MEDIACRAWLER_ROOT || path.join(projectRoot, "MediaCrawler"),
  );
  const wechatRoot = path.resolve(process.env.SCOUT_WECHAT_ROOT || path.join(projectRoot, "wechat-spider"));

  return {
    projectRoot,
    stateDir,
    mediaCrawlerRoot,
    wechatRoot,
    wechatEnableDb: toBool(process.env.SCOUT_WECHAT_ENABLE_DB, true),
    batchSize: toInt(process.env.SCOUT_BATCH_SIZE, 500),
    alertDlqThreshold: toInt(process.env.SCOUT_ALERT_DLQ_THRESHOLD, 10),
    schedulerIntervalSec: toInt(process.env.SCOUT_SCHEDULER_INTERVAL_SEC, 300),
    monitorHost: process.env.SCOUT_MONITOR_HOST || "127.0.0.1",
    monitorPort: toInt(process.env.SCOUT_MONITOR_PORT, 18080),
    wechatMysqlHost: process.env.WECHAT_MYSQL_HOST || "127.0.0.1",
    wechatMysqlPort: toInt(process.env.WECHAT_MYSQL_PORT, 3306),
    wechatMysqlDb: process.env.WECHAT_MYSQL_DB || "test",
    wechatMysqlUser: process.env.WECHAT_MYSQL_USER || "root",
    wechatMysqlPasswd: process.env.WECHAT_MYSQL_PASSWD || "",
  };
}
