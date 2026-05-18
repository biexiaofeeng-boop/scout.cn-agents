# Task Package SO2: Scout Ops Control Actions v1

Date: 2026-05-18

## Goal

Add controlled operational actions after the readonly console is stable.

SO2 turns Scout Ops Console from observation-only into a guarded operator workflow for topic collection, normalization, report generation, and recovery.

## Dependency

SO2 depends on SO1.

Do not start SO2 until operators can inspect topics, providers, artifacts, and hub health from `/ops`.

## Scope

### In Scope

- `POST /ops/runs/collect-topic`
- `POST /ops/runs/normalize-topic`
- `POST /ops/runs/collect-and-normalize-topic`
- run state persisted under `/Users/sourcefire/1data/scout/runs/<run-id>/`
- topic-level and batch-level run summaries
- bounded logs for each run
- optional dry-run mode
- provider allowlist per run
- basic action confirmation in UI

### Out of Scope

- Full scheduler editor
- WebSocket logs in first SO2 pass
- topic/seed editing
- account credential management
- arbitrary shell command execution from UI

## Required Guardrails

- Only allow known providers from provider registry
- Only allow known topic IDs from topic catalog
- Never render or echo secrets
- Require explicit provider selection for account-sensitive providers
- Default `youtube` to disabled if `YOUTUBE_API_KEY` is missing
- Write run logs to Scout runtime data, not git-tracked directories
- Expose status and artifacts, not raw stack traces, in the UI

## Proposed Runtime Layout

```text
/Users/sourcefire/1data/scout/runs/
  scout_run_<timestamp>_<suffix>/
    run.json
    logs.jsonl
    items.jsonl
    summary.json
    report.md
```

## Proposed API

```text
POST /ops/runs/collect-topic
POST /ops/runs/normalize-topic
POST /ops/runs/collect-and-normalize-topic
GET  /ops/runs/:runId
GET  /ops/runs/:runId/logs
```

## Acceptance Criteria

- operator can select one topic and run Steam/Reddit collection from UI
- normalize can run from UI and refresh artifact state
- every action creates a persisted run record
- failures are visible and non-destructive
- existing CLI commands remain usable

## Follow-up Iterations

- WebSocket log streaming
- schedule editor
- review queue approve/reject
- failed run retry button
- GameLens handoff validation button
