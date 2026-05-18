# scout-hub (TypeScript)

TS control-plane for staged migration (Phase A + Phase B):

- Phase A: unified pipeline + idempotent ingestion + scheduler + monitor API
- Phase B: keep existing Python crawlers as data providers (no rewrite required yet)
- SO1: readonly Ops Console for topic/provider/runtime artifact observability
- SO2: guarded Ops actions for topic collection, normalization, run records, and reports
- SO2.1: retry, run cleanup, and review queue gates before scheduler editing

## Commands

```bash
cd /Users/sourcefire/1data/scout-lab/scout-hub
npm install
npm run pipeline:once
npm run api
npm run scheduler
```

Ops Console endpoints are served by the API process:

```text
http://127.0.0.1:18080/ops
http://127.0.0.1:18080/ops/overview.json
POST http://127.0.0.1:18080/ops/runs/collect-topic
POST http://127.0.0.1:18080/ops/runs/normalize-topic
POST http://127.0.0.1:18080/ops/runs/collect-and-normalize-topic
GET  http://127.0.0.1:18080/ops/runs/<run-id>
GET  http://127.0.0.1:18080/ops/runs/<run-id>/logs
POST http://127.0.0.1:18080/ops/runs/<run-id>/retry
POST http://127.0.0.1:18080/ops/runs/cleanup
GET  http://127.0.0.1:18080/ops/review-queue
POST http://127.0.0.1:18080/ops/review-queue/<review-id>/decision
```

SO2 actions are intentionally constrained:

- only known topic IDs from `scout-media-agents/config/topics/scout-topics.json`
- only allowlisted providers in the first pass: `steam`, `reddit`, `youtube`
- YouTube live collection requires `YOUTUBE_API_KEY`; use dry-run for wiring checks before configuring it
- no arbitrary shell command input from the UI or API
- run records are written to `SCOUT_RUNTIME_ROOT/runs/<run-id>/`
- review records are written to `SCOUT_RUNTIME_ROOT/review-queue/<review-id>.json`

## Environment

Copy `.env.example` to `.env` if needed.

- `SCOUT_PROJECT_ROOT` default: parent dir of `scout-hub`
- `SCOUT_RUNTIME_ROOT` default: `/Users/sourcefire/1data/scout`
- `SCOUT_VENDOR_ROOT` default: `../scout-vendor`
- `SCOUT_MEDIACRAWLER_ROOT` default: `../scout-vendor/mediacrawler`
- `SCOUT_WECHAT_ROOT` default: `../wechat-spider`
- `SCOUT_WECHAT_ENABLE_DB` default: `true`
- `SCOUT_BATCH_SIZE` default: `500`
- `SCOUT_ALERT_DLQ_THRESHOLD` default: `10`
- `SCOUT_OPS_ACTION_TIMEOUT_MS` default: `180000`
- `SCOUT_OPS_RUN_RETENTION_DAYS` default: `30`
- `SCOUT_OPS_RUN_RETENTION_MAX` default: `300`
- `SCOUT_MONITOR_HOST` default: `127.0.0.1`
- `SCOUT_MONITOR_PORT` default: `18080`
- `YOUTUBE_API_KEY` optional: required only for live YouTube collection

State files are persisted under `scout-hub/state/`.
