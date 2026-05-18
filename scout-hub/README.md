# scout-hub (TypeScript)

TS control-plane for staged migration (Phase A + Phase B):

- Phase A: unified pipeline + idempotent ingestion + scheduler + monitor API
- Phase B: keep existing Python crawlers as data providers (no rewrite required yet)
- SO1: readonly Ops Console for topic/provider/runtime artifact observability

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
```

SO1 is readonly: it shows topic catalog, provider readiness, hub health, latest runs, and runtime artifacts. It does not start/stop collection jobs.

## Environment

Copy `.env.example` to `.env` if needed.

- `SCOUT_PROJECT_ROOT` default: parent dir of `scout-hub`
- `SCOUT_RUNTIME_ROOT` default: `/Users/sourcefire/1data/scout`
- `SCOUT_MEDIACRAWLER_ROOT` default: `../scout-vendor/mediacrawler`
- `SCOUT_WECHAT_ROOT` default: `../wechat-spider`
- `SCOUT_WECHAT_ENABLE_DB` default: `true`
- `SCOUT_BATCH_SIZE` default: `500`
- `SCOUT_ALERT_DLQ_THRESHOLD` default: `10`
- `SCOUT_MONITOR_HOST` default: `127.0.0.1`
- `SCOUT_MONITOR_PORT` default: `18080`

State files are persisted under `scout-hub/state/`.
