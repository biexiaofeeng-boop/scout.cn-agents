from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

from ..models import UnifiedEvent


def _safe_str(v) -> str:
    return "" if v is None else str(v)


def _extract_content_id(item: Dict) -> str:
    for key in (
        "note_id",
        "aweme_id",
        "video_id",
        "content_id",
        "post_id",
        "comment_id",
        "id",
    ):
        if item.get(key):
            return str(item.get(key))
    return ""


def _extract_account_id(item: Dict) -> str:
    for key in ("user_id", "author_id", "uid", "account_id"):
        if item.get(key):
            return str(item.get(key))
    return ""


def _extract_account_name(item: Dict) -> str:
    for key in ("nickname", "author", "user_name", "account"):
        if item.get(key):
            return str(item.get(key))
    return ""


def _extract_published_at(item: Dict) -> str:
    for key in ("publish_time", "create_time", "time", "created_at", "updated_time"):
        v = item.get(key)
        if v is not None and v != "":
            return str(v)
    return ""


def _extract_url(item: Dict) -> str:
    for key in ("note_url", "url", "article_url", "content_url"):
        if item.get(key):
            return str(item.get(key))
    return ""


def _extract_body(item: Dict) -> str:
    for key in ("desc", "content", "text", "digest"):
        if item.get(key):
            return str(item.get(key))
    return ""


def _extract_title(item: Dict) -> str:
    for key in ("title",):
        if item.get(key):
            return str(item.get(key))
    return ""


def _extract_metrics(item: Dict) -> Dict:
    metrics = {}
    for key in (
        "liked_count",
        "collected_count",
        "comment_count",
        "share_count",
        "like_count",
        "read_num",
    ):
        if key in item and item.get(key) is not None:
            metrics[key] = item.get(key)
    return metrics


def _event_type_from_filename(path: Path) -> str:
    name = path.name.lower()
    if "comment" in name:
        return "comment"
    if "content" in name:
        return "content"
    return "content"


class MediaCrawlerAdapter:
    def __init__(self, mediacrawler_root: Path):
        self.root = mediacrawler_root
        self.data_dir = self.root / "data"

    def load_incremental(self, cursor: Dict[str, int]) -> Tuple[List[UnifiedEvent], Dict[str, int]]:
        events: List[UnifiedEvent] = []
        new_cursor = dict(cursor)

        if not self.data_dir.exists():
            return events, new_cursor

        files = sorted(self.data_dir.glob("*/jsonl/*.jsonl"))
        for file_path in files:
            cursor_key = str(file_path.resolve())
            last_line = int(cursor.get(cursor_key, 0))
            event_type = _event_type_from_filename(file_path)
            platform = file_path.parts[-3] if len(file_path.parts) >= 3 else "unknown"

            current_line = 0
            with file_path.open("r", encoding="utf-8") as f:
                for line in f:
                    current_line += 1
                    if current_line <= last_line:
                        continue

                    line = line.strip()
                    if not line:
                        continue

                    try:
                        item = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    event = UnifiedEvent(
                        source="mediacrawler",
                        source_id=f"{cursor_key}:{current_line}",
                        platform=platform,
                        event_type=event_type,
                        account_id=_extract_account_id(item),
                        account_name=_extract_account_name(item),
                        content_id=_extract_content_id(item),
                        title=_extract_title(item),
                        body=_extract_body(item),
                        url=_extract_url(item),
                        published_at=_extract_published_at(item),
                        collected_at=datetime.now(timezone.utc).isoformat(),
                        metrics=_extract_metrics(item),
                        raw_payload=item,
                    )
                    events.append(event)

            new_cursor[cursor_key] = current_line

        return events, new_cursor
