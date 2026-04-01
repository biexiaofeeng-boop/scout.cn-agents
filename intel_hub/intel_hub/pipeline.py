from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import uuid4

from .adapters.mediacrawler import MediaCrawlerAdapter
from .adapters.wechat_spider import WechatSpiderAdapter
from .config import load_settings
from .db import IntelDB
from .dlq import DLQ
from .metrics import PipelineMetrics
from .models import UnifiedEvent
from .retry import retry_call


@dataclass
class PipelineResult:
    run_id: str
    status: str
    processed_count: int
    failed_count: int


class IntelPipeline:
    def __init__(self):
        self.settings = load_settings()
        self.db = IntelDB(self.settings.db_path)
        self.dlq = DLQ(self.settings.dlq_path)
        self.metrics = PipelineMetrics()

        self.mediacrawler_adapter = MediaCrawlerAdapter(self.settings.mediacrawler_root)
        self.wechat_adapter = WechatSpiderAdapter(self.settings.wechat_root, batch_size=self.settings.batch_size)

    def _load_cursor(self, source_key: str) -> dict:
        raw = self.db.get_checkpoint(source_key, default="{}")
        try:
            data = json.loads(raw)
            return data if isinstance(data, dict) else {}
        except json.JSONDecodeError:
            return {}

    def _save_cursor(self, source_key: str, cursor: dict) -> None:
        self.db.upsert_checkpoint(
            source_key=source_key,
            cursor=json.dumps(cursor, ensure_ascii=False, sort_keys=True),
            updated_at=datetime.now(timezone.utc).isoformat(),
        )

    def _ingest_source(self, source_name: str, loader) -> tuple[int, int]:
        cursor_key = f"cursor:{source_name}"
        old_cursor = self._load_cursor(cursor_key)

        events: list[UnifiedEvent] = []
        new_cursor = old_cursor

        try:
            events, new_cursor = retry_call(lambda: loader(old_cursor), attempts=3, base_delay_sec=0.5)
        except Exception as exc:  # noqa: BLE001
            self.dlq.push(source_name, {"cursor": old_cursor}, f"source_load_failed: {exc}")
            return 0, 1

        failed = 0
        valid_events: list[UnifiedEvent] = []
        for event in events:
            try:
                # Record hash generation itself validates essential fields.
                event.record_hash()
                valid_events.append(event)
            except Exception as exc:  # noqa: BLE001
                failed += 1
                self.dlq.push(source_name, event.raw_payload, f"normalize_failed: {exc}")

        insert_stats = self.db.insert_events(valid_events)
        self.metrics.events_inserted += insert_stats["inserted"]
        self.metrics.events_skipped += insert_stats["skipped"]
        self.metrics.records_failed += failed

        self._save_cursor(cursor_key, new_cursor)
        return insert_stats["inserted"], failed

    def run_once(self) -> PipelineResult:
        run_id = str(uuid4())
        started_at = datetime.now(timezone.utc).isoformat()

        self.metrics.mark_run_start()
        self.db.start_run(run_id, started_at)

        processed = 0
        failed = 0
        status = "success"
        error_text = None

        try:
            inserted, load_failed = self._ingest_source(
                "mediacrawler",
                self.mediacrawler_adapter.load_incremental,
            )
            processed += inserted
            failed += load_failed

            if self.settings.wechat_enable_db:
                inserted, load_failed = self._ingest_source(
                    "wechat-spider",
                    self.wechat_adapter.load_incremental,
                )
                processed += inserted
                failed += load_failed

            if failed > 0:
                status = "partial_failed"

        except Exception as exc:  # noqa: BLE001
            status = "failed"
            failed += 1
            error_text = str(exc)
            self.dlq.push("pipeline", {"run_id": run_id}, error_text)

        ended_at = datetime.now(timezone.utc).isoformat()

        self.db.finish_run(
            run_id=run_id,
            ended_at=ended_at,
            status=status,
            processed_count=processed,
            failed_count=failed,
            error_text=error_text,
        )

        self.metrics.mark_run_end(failed=status != "success")
        self.db.save_metrics_snapshot(ended_at, self.metrics.snapshot_json())

        return PipelineResult(
            run_id=run_id,
            status=status,
            processed_count=processed,
            failed_count=failed,
        )

    def current_health(self) -> dict:
        total_events = self.db.count_events()
        dlq_size = self.dlq.size()
        return {
            "db_path": str(self.settings.db_path),
            "total_events": total_events,
            "dlq_size": dlq_size,
            "alert": dlq_size >= self.settings.alert_dlq_threshold,
            "metrics": self.metrics.as_dict(),
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Intel hub pipeline runner")
    parser.add_argument("--once", action="store_true", help="run one pipeline cycle")
    args = parser.parse_args()

    pipeline = IntelPipeline()
    result = pipeline.run_once()
    print(json.dumps(result.__dict__, ensure_ascii=False))

    if not args.once:
        print(json.dumps(pipeline.current_health(), ensure_ascii=False))


if __name__ == "__main__":
    main()
