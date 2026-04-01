from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any, Dict
import json


@dataclass
class UnifiedEvent:
    source: str
    source_id: str
    platform: str
    event_type: str
    account_id: str
    account_name: str
    content_id: str
    title: str
    body: str
    url: str
    published_at: str
    collected_at: str
    metrics: Dict[str, Any]
    raw_payload: Dict[str, Any]

    def record_hash(self) -> str:
        stable = {
            "source": self.source,
            "platform": self.platform,
            "event_type": self.event_type,
            "content_id": self.content_id,
            "account_id": self.account_id,
            "published_at": self.published_at,
            "url": self.url,
        }
        return sha256(json.dumps(stable, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()

    def to_db_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["metrics"] = json.dumps(self.metrics, ensure_ascii=False)
        d["raw_payload"] = json.dumps(self.raw_payload, ensure_ascii=False)
        d["record_hash"] = self.record_hash()
        d["ingested_at"] = datetime.now(timezone.utc).isoformat()
        return d
