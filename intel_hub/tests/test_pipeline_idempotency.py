from __future__ import annotations

from pathlib import Path

from intel_hub.db import IntelDB
from intel_hub.models import UnifiedEvent


def _mk_event(content_id: str) -> UnifiedEvent:
    return UnifiedEvent(
        source="mediacrawler",
        source_id=f"src:{content_id}",
        platform="xhs",
        event_type="content",
        account_id="u1",
        account_name="nick",
        content_id=content_id,
        title="title",
        body="body",
        url=f"https://example.com/{content_id}",
        published_at="2026-01-01 00:00:00",
        collected_at="2026-01-01T00:00:00Z",
        metrics={"liked_count": 1},
        raw_payload={"id": content_id},
    )


def test_idempotent_insert(tmp_path: Path):
    db = IntelDB(tmp_path / "intel.db")
    e1 = _mk_event("a1")
    e2 = _mk_event("a1")

    s1 = db.insert_events([e1])
    s2 = db.insert_events([e2])

    assert s1["inserted"] == 1
    assert s1["skipped"] == 0
    assert s2["inserted"] == 0
    assert s2["skipped"] == 1
    assert db.count_events() == 1
