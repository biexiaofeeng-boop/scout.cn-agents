from __future__ import annotations

import argparse
import json
import time

from .pipeline import IntelPipeline


def main() -> None:
    parser = argparse.ArgumentParser(description="Intel hub scheduler")
    parser.add_argument("--interval", type=int, default=3600, help="seconds between runs")
    args = parser.parse_args()

    pipeline = IntelPipeline()

    while True:
        result = pipeline.run_once()
        print(json.dumps(result.__dict__, ensure_ascii=False))
        time.sleep(max(5, args.interval))


if __name__ == "__main__":
    main()
