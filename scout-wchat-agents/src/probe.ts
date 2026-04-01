import "dotenv/config";
import mysql from "mysql2/promise";

async function probeHttp(base: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const resp = await fetch(base, { method: "GET" });
    return { ok: resp.ok, status: resp.status };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function probeMysql(): Promise<{ ok: boolean; error?: string }> {
  const conn = await mysql.createConnection({
    host: process.env.WECHAT_MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.WECHAT_MYSQL_PORT || 3306),
    user: process.env.WECHAT_MYSQL_USER || "root",
    password: process.env.WECHAT_MYSQL_PASSWD || "",
    database: process.env.WECHAT_MYSQL_DB || "test",
  });

  try {
    await conn.query("SELECT 1");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    await conn.end();
  }
}

async function main(): Promise<void> {
  const base = process.env.SCOUT_WCHAT_PROXY_BASE || "http://127.0.0.1:8080";
  const http = await probeHttp(base);
  const mysqlStatus = await probeMysql().catch((err) => ({ ok: false, error: String(err) }));

  console.log(
    JSON.stringify(
      {
        http,
        mysql: mysqlStatus,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
