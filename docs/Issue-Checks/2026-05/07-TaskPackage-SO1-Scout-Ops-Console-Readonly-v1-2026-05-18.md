# Task Package SO1: Scout Ops Console Readonly v1

Date: 2026-05-18

## Goal

Build the first production-operations UI for Scout as a readonly console inside `scout-ops`.

The console must help operators understand whether Scout is ready to run and what data artifacts already exist, without requiring CLI spelunking.

中文说明：SO1 的目标是先建立“看得见”的运营驾驶舱，不做任何会改变运行状态的按钮。

## Why Now

Scout already has:

- topic catalog in `scout-media-agents`
- provider registry and collection wrappers in `scout-vendor`
- normalized evidence and GameLens handoff under `/Users/sourcefire/1data/scout`
- hub health, metrics, runs, alerts
- Docker runtime for WeChat/hub services

But Scout lacks a single operator page that explains:

- which topics exist
- which providers are ready
- whether runtime artifacts exist
- what the latest runs look like
- where reports/handoff files are

This is the minimum UI needed before regular operations.

## Scope

### In Scope

- `GET /ops`: server-rendered readonly HTML console
- `GET /ops/overview.json`: machine-readable overview
- Topic table sourced from `scout-media-agents/config/topics/scout-topics.json`
- Provider table sourced from `scout-vendor/src/providers.ts` or a local equivalent snapshot
- Runtime artifact scan under `/Users/sourcefire/1data/scout/topics/<vertical>/<topic-id>/`
- Hub health and latest runs from current `ScoutPipeline`
- Links to latest topic report and GameLens handoff path when available
- README update for operator entry point

### Out of Scope

- Starting/stopping provider collection from UI
- WebSocket log streaming
- Editing topics/seeds/review decisions
- Scheduler configuration UI
- Moving MediaCrawler or WeChat runtime paths
- Copying BeautyQA or MediaCrawler upstream UI code

## Architecture Decision

Use `scout-ops` server-rendered HTML first.

Reasons:

- fastest path to production observability
- no frontend build chain in P0
- consistent with BeautyQA readonly `ops.py` design
- safer than exposing operational write actions immediately

## Deliverables

1. `scout-ops/src/ops/types.ts`
2. `scout-ops/src/ops/runtimeScanner.ts`
3. `scout-ops/src/ops/opsService.ts`
4. `scout-ops/src/ops/opsPages.ts`
5. `scout-ops/src/server.ts` route integration
6. README updates

## Acceptance Criteria

- `npm run check` passes in `scout-ops`
- `GET /ops/overview.json` returns JSON with topics, providers, hub health, recent runs, and runtime artifacts
- `GET /ops` returns readable HTML without external assets
- Missing runtime files are shown as missing, not treated as fatal errors
- No secrets are rendered
- No write actions exist in SO1

## Risk Notes

- Provider registry currently lives in `scout-vendor`, not `scout-ops`. SO1 can read lightweight static metadata or import with care. Avoid creating tight runtime coupling that breaks Docker.
- Runtime root defaults to `/Users/sourcefire/1data/scout`; in Docker, this path may not exist unless mounted. SO1 must degrade gracefully.
- This UI is an operations aid, not the source of truth. Source remains topic config, provider registry, runtime artifacts, and hub state.
