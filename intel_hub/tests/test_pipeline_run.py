from __future__ import annotations

import json
from pathlib import Path

from intel_hub.pipeline import IntelPipeline


def test_pipeline_run_with_mediacrawler_only(tmp_path: Path, monkeypatch):
    mediacrawler_root = tmp_path / "MediaCrawler"
    jsonl_file = mediacrawler_root / "data" / "xhs" / "jsonl" / "search_contents_2026-01-01.jsonl"
    jsonl_file.parent.mkdir(parents=True, exist_ok=True)

    with jsonl_file.open("w", encoding="utf-8") as f:
        f.write(json.dumps({"note_id": "n1", "title": "t1", "desc": "d1", "user_id": "u1"}) + "\n")

    db_path = tmp_path / "state" / "intel.db"

    monkeypatch.setenv("INTEL_DB_PATH", str(db_path))
    monkeypatch.setenv("INTEL_MEDIACRAWLER_ROOT", str(mediacrawler_root))
    monkeypatch.setenv("INTEL_WECHAT_ENABLE_DB", "false")

    p = IntelPipeline()
    res = p.run_once()

    assert res.status in {"success", "partial_failed"}
    assert res.processed_count == 1
    assert p.db.count_events() == 1
