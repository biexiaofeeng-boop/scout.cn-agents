from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    db_path: Path
    state_dir: Path
    mediacrawler_root: Path
    wechat_root: Path
    wechat_enable_db: bool
    batch_size: int
    dlq_path: Path
    alert_dlq_threshold: int


def _to_bool(v: str, default: bool = False) -> bool:
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "on"}


def load_settings() -> Settings:
    base_dir = Path(__file__).resolve().parents[1]
    state_dir = base_dir / "state"
    state_dir.mkdir(parents=True, exist_ok=True)

    db_path = Path(os.getenv("INTEL_DB_PATH", str(state_dir / "intel.db"))).expanduser().resolve()

    mediacrawler_root = Path(
        os.getenv(
            "INTEL_MEDIACRAWLER_ROOT",
            str(base_dir.parent / "MediaCrawler"),
        )
    ).expanduser().resolve()

    wechat_root = Path(
        os.getenv(
            "INTEL_WECHAT_ROOT",
            str(base_dir.parent / "wechat-spider"),
        )
    ).expanduser().resolve()

    return Settings(
        db_path=db_path,
        state_dir=state_dir,
        mediacrawler_root=mediacrawler_root,
        wechat_root=wechat_root,
        wechat_enable_db=_to_bool(os.getenv("INTEL_WECHAT_ENABLE_DB", "true"), default=True),
        batch_size=int(os.getenv("INTEL_BATCH_SIZE", "500")),
        dlq_path=Path(os.getenv("INTEL_DLQ_PATH", str(state_dir / "dlq.jsonl"))).expanduser().resolve(),
        alert_dlq_threshold=int(os.getenv("INTEL_ALERT_DLQ_THRESHOLD", "10")),
    )
