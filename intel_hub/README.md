# Intel Hub

Unified intelligence ingestion layer for integrating `MediaCrawler` and `wechat-spider`.

## What It Provides

- Unified schema (`content`, `comment`, `dynamic`) across both sources
- Incremental ingestion with checkpoints
- Idempotent writes using deterministic record hash
- Retry wrapper for source extraction failures
- Dead-letter queue for failed records
- Pipeline run logs and metrics snapshot
- Optional scheduler loop
- Optional monitor API (FastAPI)

## Quick Start

```bash
cd /Users/sourcefire/1data/scout-lab/intel_hub
python -m intel_hub.pipeline --once
```

Run scheduler:

```bash
python -m intel_hub.scheduler --interval 3600
```

Run monitor API:

```bash
python -m intel_hub.monitor_api --host 127.0.0.1 --port 18080
```

## Environment Variables

- `INTEL_DB_PATH` (default: `state/intel.db`)
- `INTEL_MEDIACRAWLER_ROOT` (default: `../MediaCrawler`)
- `INTEL_WECHAT_ROOT` (default: `../wechat-spider`)
- `INTEL_WECHAT_ENABLE_DB` (default: `true`)
- `INTEL_BATCH_SIZE` (default: `500`)
- `INTEL_ALERT_DLQ_THRESHOLD` (default: `10`)

For WeChat DB overrides:

- `WECHAT_MYSQL_HOST`
- `WECHAT_MYSQL_PORT`
- `WECHAT_MYSQL_DB`
- `WECHAT_MYSQL_USER`
- `WECHAT_MYSQL_PASSWD`

## Data Model

Main table: `intel_events`

- `source`: `mediacrawler` or `wechat-spider`
- `event_type`: `content`, `comment`, `dynamic`
- `platform`: e.g. `xhs`, `dy`, `wechat`
- `record_hash`: unique hash for idempotency
- `raw_payload`: raw source JSON for traceability

## Tests

```bash
python -m pytest -q /Users/sourcefire/1data/scout-lab/intel_hub/tests
```
