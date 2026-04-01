from __future__ import annotations

import time
from typing import Callable, TypeVar


T = TypeVar("T")


def retry_call(fn: Callable[[], T], attempts: int = 3, base_delay_sec: float = 0.5) -> T:
    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt == attempts:
                break
            time.sleep(base_delay_sec * (2 ** (attempt - 1)))
    raise last_error
