import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import YAML from "yaml";
import { Settings } from "../config.js";
import { UnifiedEvent } from "../models.js";

type Cursor = {
  wechatArticleLastId?: number;
  wechatCommentLastId?: number;
};

type DbConfig = {
  host: string;
  port: number;
  db: string;
  user: string;
  passwd: string;
};

export class WechatSpiderAdapter {
  constructor(
    private readonly settings: Settings,
    private readonly batchSize: number,
  ) {}

  private async resolveDbConfig(): Promise<DbConfig> {
    const cfgPath = path.join(this.settings.wechatRoot, "wechat-spider", "config.yaml");
    let fromYaml: Partial<DbConfig> = {};
    try {
      const raw = await fs.readFile(cfgPath, "utf-8");
      const parsed = YAML.parse(raw) as { mysqldb?: Record<string, unknown> };
      const mysqlCfg = parsed?.mysqldb || {};
      fromYaml = {
        host: String(mysqlCfg.ip || ""),
        port: Number(mysqlCfg.port || 3306),
        db: String(mysqlCfg.db || ""),
        user: String(mysqlCfg.user || ""),
        passwd: String(mysqlCfg.passwd || ""),
      };
    } catch {
      fromYaml = {};
    }

    return {
      host: this.settings.wechatMysqlHost || fromYaml.host || "127.0.0.1",
      port: this.settings.wechatMysqlPort || fromYaml.port || 3306,
      db: this.settings.wechatMysqlDb || fromYaml.db || "test",
      user: this.settings.wechatMysqlUser || fromYaml.user || "root",
      passwd: this.settings.wechatMysqlPasswd || fromYaml.passwd || "",
    };
  }

  async loadIncremental(cursor: Cursor): Promise<{ events: UnifiedEvent[]; cursor: Cursor }> {
    const dbConfig = await this.resolveDbConfig();
    const conn = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.passwd,
      database: dbConfig.db,
    });

    const nextCursor: Cursor = { ...cursor };
    const events: UnifiedEvent[] = [];

    try {
      const articleLast = Number(cursor.wechatArticleLastId || 0);
      const [articleRows] = await conn.query<mysql.RowDataPacket[]>(
        `
        SELECT id, __biz, account, title, url, author, publish_time, digest, source_url, sn, spider_time
        FROM wechat_article
        WHERE id > ?
        ORDER BY id ASC
        LIMIT ?
      `,
        [articleLast, this.batchSize],
      );

      if (articleRows.length > 0) {
        nextCursor.wechatArticleLastId = Number(articleRows[articleRows.length - 1].id);
      }

      const sns = articleRows.map((r) => String(r.sn || "")).filter(Boolean);
      const dynamicBySn = new Map<string, mysql.RowDataPacket>();

      if (sns.length > 0) {
        const placeholders = sns.map(() => "?").join(",");
        const [dynamicRows] = await conn.query<mysql.RowDataPacket[]>(
          `SELECT sn, read_num, like_num, comment_count FROM wechat_article_dynamic WHERE sn IN (${placeholders})`,
          sns,
        );
        for (const row of dynamicRows) {
          dynamicBySn.set(String(row.sn), row);
        }
      }

      for (const row of articleRows) {
        const sn = String(row.sn || "");
        const dynamic = dynamicBySn.get(sn);

        const metrics: Record<string, unknown> = {};
        if (dynamic?.read_num !== undefined) metrics.read_num = dynamic.read_num;
        if (dynamic?.like_num !== undefined) metrics.like_num = dynamic.like_num;
        if (dynamic?.comment_count !== undefined) metrics.comment_count = dynamic.comment_count;

        events.push({
          source: "wechat-spider",
          sourceId: `wechat_article:${row.id}`,
          platform: "wechat",
          eventType: "content",
          accountId: String(row.__biz || ""),
          accountName: String(row.account || ""),
          contentId: sn || String(row.id),
          title: String(row.title || ""),
          body: String(row.digest || ""),
          url: String(row.url || ""),
          publishedAt: String(row.publish_time || ""),
          collectedAt: String(row.spider_time || new Date().toISOString()),
          metrics,
          rawPayload: row as Record<string, unknown>,
        });
      }

      const commentLast = Number(cursor.wechatCommentLastId || 0);
      const [commentRows] = await conn.query<mysql.RowDataPacket[]>(
        `
        SELECT id, __biz, comment_id, nick_name, content, create_time, content_id, like_num, spider_time
        FROM wechat_article_comment
        WHERE id > ?
        ORDER BY id ASC
        LIMIT ?
      `,
        [commentLast, this.batchSize],
      );

      if (commentRows.length > 0) {
        nextCursor.wechatCommentLastId = Number(commentRows[commentRows.length - 1].id);
      }

      for (const row of commentRows) {
        events.push({
          source: "wechat-spider",
          sourceId: `wechat_comment:${row.id}`,
          platform: "wechat",
          eventType: "comment",
          accountId: String(row.__biz || ""),
          accountName: "",
          contentId: String(row.content_id || row.comment_id || row.id || ""),
          title: "",
          body: String(row.content || ""),
          url: "",
          publishedAt: String(row.create_time || ""),
          collectedAt: String(row.spider_time || new Date().toISOString()),
          metrics: { like_num: row.like_num },
          rawPayload: row as Record<string, unknown>,
        });
      }

      return { events, cursor: nextCursor };
    } finally {
      await conn.end();
    }
  }
}
