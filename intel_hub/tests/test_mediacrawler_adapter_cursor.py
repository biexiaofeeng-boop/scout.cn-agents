from __future__ import annotations

import json
from pathlib import Path

from intel_hub.adapters.mediacrawler import MediaCrawlerAdapter


def test_incremental_cursor(tmp_path: Path):
    root = tmp_path / "MediaCrawler"
    data_file = root / "data" / "xhs" / "jsonl" / "search_contents_2026-01-01.jsonl"
    data_file.parent.mkdir(parents=True, exist_ok=True)

    rows = [
        {"note_id": "1", "title": "A", "desc": "a", "user_id": "u1", "nickname": "n1"},
        {"note_id": "2", "title": "B", "desc": "b", "user_id": "u2", "nickname": "n2"},
    ]

    with data_file.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    adapter = MediaCrawlerAdapter(root)
    events1, c1 = adapter.load_incremental({})
    assert len(events1) == 2

    events2, c2 = adapter.load_incremental(c1)
    assert len(events2) == 0
    assert c2 == c1
