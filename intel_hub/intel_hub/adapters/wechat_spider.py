from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple

from ..models import UnifiedEvent


class WechatSpiderAdapter:
    def __init__(self, wechat_root: Path, batch_size: int = 500):
        self.root = wechat_root
        self.batch_size = batch_size
        self.config_path = self.root / "wechat-spider" / "config.yaml"

    def _load_db_config(self) -> Dict:
        try:
            import yaml
        except ImportError as exc:  # pragma: no cover - import guard
            raise RuntimeError("PyYAML is required for wechat-spider adapter") from exc

        if not self.config_path.exists():
            return {}

        with self.config_path.open("r", encoding="utf-8") as f:
            config = yaml.safe_load(f) or {}

        db_cfg = dict(config.get("mysqldb", {}))
        db_cfg["ip"] = os.getenv("WECHAT_MYSQL_HOST", db_cfg.get("ip"))
        db_cfg["port"] = int(os.getenv("WECHAT_MYSQL_PORT", str(db_cfg.get("port", 3306))))
        db_cfg["db"] = os.getenv("WECHAT_MYSQL_DB", db_cfg.get("db"))
        db_cfg["user"] = os.getenv("WECHAT_MYSQL_USER", db_cfg.get("user"))
        db_cfg["passwd"] = os.getenv("WECHAT_MYSQL_PASSWD", db_cfg.get("passwd"))
        return db_cfg

    def _connect(self):
        import pymysql

        db_cfg = self._load_db_config()
        required = ("ip", "port", "db", "user")
        if not all(db_cfg.get(k) for k in required):
            raise RuntimeError("Incomplete wechat-spider MySQL configuration")

        return pymysql.connect(
            host=db_cfg["ip"],
            port=int(db_cfg["port"]),
            user=db_cfg["user"],
            passwd=db_cfg.get("passwd") or "",
            db=db_cfg["db"],
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
        )

    def load_incremental(self, cursor: Dict[str, int]) -> Tuple[List[UnifiedEvent], Dict[str, int]]:
        events: List[UnifiedEvent] = []
        new_cursor = dict(cursor)

        conn = self._connect()
        try:
            with conn.cursor() as cur:
                article_last = int(cursor.get("wechat_article_last_id", 0))
                cur.execute(
                    """
                    SELECT id, __biz, account, title, url, author, publish_time, digest, source_url, sn, spider_time
                    FROM wechat_article
                    WHERE id > %s
                    ORDER BY id ASC
                    LIMIT %s
                    """,
                    (article_last, self.batch_size),
                )
                article_rows = cur.fetchall() or []

                if article_rows:
                    article_last = article_rows[-1]["id"]
                    new_cursor["wechat_article_last_id"] = article_last

                sns = [r.get("sn") for r in article_rows if r.get("sn")]
                dynamic_by_sn = {}
                if sns:
                    placeholders = ",".join(["%s"] * len(sns))
                    cur.execute(
                        f"SELECT sn, read_num, like_num, comment_count FROM wechat_article_dynamic WHERE sn IN ({placeholders})",
                        tuple(sns),
                    )
                    for row in cur.fetchall() or []:
                        dynamic_by_sn[row.get("sn")] = row

                for row in article_rows:
                    sn = row.get("sn")
                    dynamic = dynamic_by_sn.get(sn, {})
                    metrics = {
                        "read_num": dynamic.get("read_num"),
                        "like_num": dynamic.get("like_num"),
                        "comment_count": dynamic.get("comment_count"),
                    }
                    metrics = {k: v for k, v in metrics.items() if v is not None}

                    events.append(
                        UnifiedEvent(
                            source="wechat-spider",
                            source_id=f"wechat_article:{row['id']}",
                            platform="wechat",
                            event_type="content",
                            account_id=str(row.get("__biz") or ""),
                            account_name=str(row.get("account") or ""),
                            content_id=str(sn or row.get("id") or ""),
                            title=str(row.get("title") or ""),
                            body=str(row.get("digest") or ""),
                            url=str(row.get("url") or ""),
                            published_at=str(row.get("publish_time") or ""),
                            collected_at=str(row.get("spider_time") or datetime.now(timezone.utc).isoformat()),
                            metrics=metrics,
                            raw_payload=row,
                        )
                    )

                comment_last = int(cursor.get("wechat_comment_last_id", 0))
                cur.execute(
                    """
                    SELECT id, __biz, comment_id, nick_name, content, create_time, content_id, like_num, spider_time
                    FROM wechat_article_comment
                    WHERE id > %s
                    ORDER BY id ASC
                    LIMIT %s
                    """,
                    (comment_last, self.batch_size),
                )
                comment_rows = cur.fetchall() or []

                if comment_rows:
                    comment_last = comment_rows[-1]["id"]
                    new_cursor["wechat_comment_last_id"] = comment_last

                for row in comment_rows:
                    events.append(
                        UnifiedEvent(
                            source="wechat-spider",
                            source_id=f"wechat_comment:{row['id']}",
                            platform="wechat",
                            event_type="comment",
                            account_id=str(row.get("__biz") or ""),
                            account_name="",
                            content_id=str(row.get("content_id") or row.get("comment_id") or row.get("id") or ""),
                            title="",
                            body=str(row.get("content") or ""),
                            url="",
                            published_at=str(row.get("create_time") or ""),
                            collected_at=str(row.get("spider_time") or datetime.now(timezone.utc).isoformat()),
                            metrics={"like_num": row.get("like_num")},
                            raw_payload=row,
                        )
                    )

        finally:
            conn.close()

        return events, new_cursor
