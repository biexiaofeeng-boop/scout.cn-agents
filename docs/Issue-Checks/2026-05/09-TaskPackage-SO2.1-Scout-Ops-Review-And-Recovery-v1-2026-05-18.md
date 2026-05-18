# Task Package SO2.1: Scout Ops Review And Recovery v1

Date: 2026-05-18

## Goal

Make SO2 safe enough for regular operations by adding recovery and review gates before scheduler editing.

SO2.1 is not a scheduler editor. It adds the missing operator controls around SO2 runs:

- retry failed or partial ops runs
- clean old run records with bounded retention
- create review items after normalization
- approve or reject review items before downstream schedule automation

## Scope

### In Scope

- `POST /ops/runs/:runId/retry`
- `POST /ops/runs/cleanup`
- `GET /ops/review-queue`
- `POST /ops/review-queue/:id/decision`
- review item persistence under `SCOUT_RUNTIME_ROOT/review-queue/`
- retry uses the stored validated run input
- UI buttons for retry, cleanup, approve, and reject

### Out Of Scope

- full scheduler editor
- WebSocket log streaming
- multi-user auth / RBAC
- manual editing of topic seeds or query plans in the UI
- automatic promotion of approved items into a scheduler

## Runtime Layout

```text
/Users/sourcefire/1data/scout/
  runs/
    scout_run_<timestamp>_<suffix>/
      run.json
      logs.jsonl
      items.jsonl
      summary.json
      report.md
  review-queue/
    review_scout_run_<timestamp>_<suffix>.json
```

## Guardrails

- Retry only replays a previous stored action and input.
- Cleanup only deletes directories whose names start with `scout_run_`.
- Review decisions only allow `approved` or `rejected`.
- Review items are runtime data and are not committed to git.

## Acceptance Criteria

- failed or partial ops runs show a retry button
- retry creates a new run instead of mutating the old one
- cleanup respects retention config
- normalize or collect-and-normalize can create a pending review item
- review item can be approved or rejected from `/ops`

## Follow-up Iterations

- review notes with richer evidence samples
- approved-review schedule handoff
- WebSocket log streaming
- run cancellation
- operator identity and audit trail
