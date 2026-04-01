from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Dict, Iterable, Optional

from .models import UnifiedEvent


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS intel_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  event_type TEXT NOT NULL,
  account_id TEXT,
  account_name TEXT,
  content_id TEXT,
  title TEXT,
  body TEXT,
  url TEXT,
  published_at TEXT,
  collected_at TEXT,
  metrics_json TEXT,
  raw_payload TEXT,
  record_hash TEXT NOT NULL UNIQUE,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_intel_events_source_platform_time
ON intel_events (source, platform, published_at);

CREATE TABLE IF NOT EXISTS intel_checkpoints (
  source_key TEXT PRIMARY KEY,
  cursor TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS intel_pipeline_runs (
  run_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL,
  processed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  error_text TEXT
);

CREATE TABLE IF NOT EXISTS intel_metrics_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recorded_at TEXT NOT NULL,
  metrics_json TEXT NOT NULL
);
"""


class IntelDB:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    @contextmanager
    def connect(self):
        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.row_factory = sqlite3.Row
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_schema(self) -> None:
        with self.connect() as conn:
            conn.executescript(SCHEMA_SQL)

    def upsert_checkpoint(self, source_key: str, cursor: str, updated_at: str) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO intel_checkpoints (source_key, cursor, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(source_key) DO UPDATE SET
                  cursor=excluded.cursor,
                  updated_at=excluded.updated_at
                """,
                (source_key, cursor, updated_at),
            )

    def get_checkpoint(self, source_key: str, default: str = "0") -> str:
        with self.connect() as conn:
            row = conn.execute(
                "SELECT cursor FROM intel_checkpoints WHERE source_key = ?",
                (source_key,),
            ).fetchone()
        return row["cursor"] if row else default

    def insert_events(self, events: Iterable[UnifiedEvent]) -> Dict[str, int]:
        inserted = 0
        skipped = 0
        with self.connect() as conn:
            for event in events:
                data = event.to_db_dict()
                try:
                    conn.execute(
                        """
                        INSERT INTO intel_events (
                          source, source_id, platform, event_type,
                          account_id, account_name, content_id,
                          title, body, url, published_at, collected_at,
                          metrics_json, raw_payload, record_hash, ingested_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            data["source"],
                            data["source_id"],
                            data["platform"],
                            data["event_type"],
                            data["account_id"],
                            data["account_name"],
                            data["content_id"],
                            data["title"],
                            data["body"],
                            data["url"],
                            data["published_at"],
                            data["collected_at"],
                            data["metrics"],
                            data["raw_payload"],
                            data["record_hash"],
                            data["ingested_at"],
                        ),
                    )
                    inserted += 1
                except sqlite3.IntegrityError:
                    skipped += 1
        return {"inserted": inserted, "skipped": skipped}

    def start_run(self, run_id: str, started_at: str) -> None:
        with self.connect() as conn:
            conn.execute(
                "INSERT INTO intel_pipeline_runs (run_id, started_at, status) VALUES (?, ?, ?)",
                (run_id, started_at, "running"),
            )

    def finish_run(
        self,
        run_id: str,
        ended_at: str,
        status: str,
        processed_count: int,
        failed_count: int,
        error_text: Optional[str] = None,
    ) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                UPDATE intel_pipeline_runs
                SET ended_at=?, status=?, processed_count=?, failed_count=?, error_text=?
                WHERE run_id=?
                """,
                (ended_at, status, processed_count, failed_count, error_text, run_id),
            )

    def save_metrics_snapshot(self, recorded_at: str, metrics_json: str) -> None:
        with self.connect() as conn:
            conn.execute(
                "INSERT INTO intel_metrics_snapshots (recorded_at, metrics_json) VALUES (?, ?)",
                (recorded_at, metrics_json),
            )

    def recent_runs(self, limit: int = 20):
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM intel_pipeline_runs ORDER BY started_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]

    def count_events(self) -> int:
        with self.connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS c FROM intel_events").fetchone()
        return int(row["c"]) if row else 0

    def count_dlq_related(self) -> int:
        with self.connect() as conn:
            row = conn.execute("SELECT COUNT(*) AS c FROM intel_pipeline_runs WHERE failed_count > 0").fetchone()
        return int(row["c"]) if row else 0
