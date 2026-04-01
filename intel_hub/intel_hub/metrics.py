from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
import json


@dataclass
class PipelineMetrics:
    runs_total: int = 0
    runs_failed: int = 0
    events_inserted: int = 0
    events_skipped: int = 0
    records_failed: int = 0
    last_run_started_at: str = ""
    last_run_ended_at: str = ""

    def mark_run_start(self) -> None:
        self.runs_total += 1
        self.last_run_started_at = datetime.now(timezone.utc).isoformat()

    def mark_run_end(self, failed: bool = False) -> None:
        if failed:
            self.runs_failed += 1
        self.last_run_ended_at = datetime.now(timezone.utc).isoformat()

    def snapshot_json(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=False)

    def as_dict(self):
        return asdict(self)
