# scout-hub (TypeScript)

TS control-plane for staged migration (Phase A + Phase B):

- Phase A: unified pipeline + idempotent ingestion + scheduler + monitor API
- Phase B: keep existing Python crawlers as data providers (no rewrite required yet)
- SO1: readonly Ops Console for topic/provider/runtime artifact observability
- SO2: guarded Ops actions for topic collection, normalization, run records, and reports
- SO2.1: retry, run cleanup, and review queue gates before scheduler editing
- SO3: timed batch scheduling via Ops Action flow + Pipeline-flow freeze toggles

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
GET  http://127.0.0.1:18080/ops/runs/<run-id>/view
GET  http://127.0.0.1:18080/ops/runs/<run-id>/logs
POST http://127.0.0.1:18080/ops/runs/<run-id>/retry
POST http://127.0.0.1:18080/ops/runs/cleanup
GET  http://127.0.0.1:18080/ops/review-queue
GET  http://127.0.0.1:18080/ops/review-queue/<review-id>/preview
POST http://127.0.0.1:18080/ops/review-queue/<review-id>/decision
GET  http://127.0.0.1:18080/ops/schedules
POST http://127.0.0.1:18080/ops/schedules
PATCH  http://127.0.0.1:18080/ops/schedules/<schedule-id>
DELETE http://127.0.0.1:18080/ops/schedules/<schedule-id>
POST http://127.0.0.1:18080/ops/schedules/<schedule-id>/run-now
```

SO2 actions are intentionally constrained:

- only known topic IDs from `scout-media-agents/config/topics/scout-topics.json`
- only allowlisted providers in the first pass: `steam`, `reddit`, `youtube`
- YouTube live collection requires `YOUTUBE_API_KEY`; use dry-run for wiring checks before configuring it
- no arbitrary shell command input from the UI or API
- run records are written to `SCOUT_RUNTIME_ROOT/runs/<run-id>/`
- review records are written to `SCOUT_RUNTIME_ROOT/review-queue/<review-id>.json`
- topics with `projectId` are written to `SCOUT_RUNTIME_ROOT/projects/<projectId>/...`

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
- `SCOUT_PIPELINE_TICK_ENABLED` default: `false` (set `true` to re-enable the wechat/mediacrawler pipeline tick in the scheduler container)
- `SCOUT_OPS_SHOW_PIPELINE_VIEWS` default: `false` (set `true` to show Hub Health and Recent Hub Runs panels in `/ops`)
- `SCOUT_MONITOR_HOST` default: `127.0.0.1`
- `SCOUT_MONITOR_PORT` default: `18080`
- `YOUTUBE_API_KEY` optional: required only for live YouTube collection

State files are persisted under `scout-hub/state/`.

## Scheduling (SO3)

Schedules run guarded Ops Actions on a cron cadence. They are stored at
`SCOUT_RUNTIME_ROOT/schedules/<schedule-id>.json` with a 5-field cron
expression and an IANA timezone (default `Asia/Shanghai`). The
scheduler container ticks every 60s and fires any due schedule through
the same `OpsActionService` used for manual runs — every scheduled run
still creates a review-queue entry, so nothing reaches downstream
consumers without operator approval.

The Ops Console exposes a Schedules panel under Control Actions with a
collapsible "+ New Schedule" form. The form offers four frequencies
(Daily / Weekly / Hourly / Every N hours); the cron expression is
assembled client-side and stored verbatim. Schedules support
pause/resume, run-now, and delete from the table row.

Timed firing requires the scheduler container to be running:

```bash
npm run scheduler
```

The `api` container alone serves the UI and API but does not advance
schedules.

## Pipeline freeze + view toggles

The legacy wechat/mediacrawler Pipeline flow is frozen by default. The
scheduler container stays alive but skips `pipeline.runOnce()` unless
`SCOUT_PIPELINE_TICK_ENABLED=true`. The Hub Health and Recent Hub Runs
panels are likewise hidden in `/ops` unless
`SCOUT_OPS_SHOW_PIPELINE_VIEWS=true`. Set both to `true` only when
restarting the legacy pipeline path.

## Tests

```bash
npm test
```

Vitest covers `OpsActionService.prepareRequest`, `cleanupRuns`,
`OpsReviewService` (sanitizeReviewId + decide + getPreview), and
`OpsScheduleService` (sanitize + CRUD + nextRunAt recomputation).
