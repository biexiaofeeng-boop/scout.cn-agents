from __future__ import annotations

import argparse
from datetime import datetime, timezone

import uvicorn
from fastapi import FastAPI

from .pipeline import IntelPipeline


pipeline = IntelPipeline()
app = FastAPI(title="Intel Hub Monitor API", version="1.0.0")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **pipeline.current_health(),
    }


@app.get("/metrics")
def metrics():
    return pipeline.current_health()


@app.get("/runs")
def runs(limit: int = 20):
    return {"runs": pipeline.db.recent_runs(limit=limit)}


@app.post("/run-once")
def run_once():
    result = pipeline.run_once()
    return result.__dict__


@app.get("/alerts")
def alerts():
    health_state = pipeline.current_health()
    alerts = []
    if health_state["dlq_size"] >= pipeline.settings.alert_dlq_threshold:
        alerts.append(
            {
                "level": "warning",
                "code": "DLQ_THRESHOLD",
                "message": f"DLQ size reached {health_state['dlq_size']}, threshold {pipeline.settings.alert_dlq_threshold}",
            }
        )
    if health_state["metrics"]["runs_failed"] > 0:
        alerts.append(
            {
                "level": "warning",
                "code": "PIPELINE_FAILURE",
                "message": f"Pipeline failures observed: {health_state['metrics']['runs_failed']}",
            }
        )
    return {"alerts": alerts}


def main() -> None:
    parser = argparse.ArgumentParser(description="Intel hub monitor API")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=18080)
    args = parser.parse_args()

    uvicorn.run("intel_hub.monitor_api:app", host=args.host, port=args.port, reload=False)


if __name__ == "__main__":
    main()
