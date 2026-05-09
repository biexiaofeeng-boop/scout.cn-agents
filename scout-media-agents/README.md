# scout-media-agents

TypeScript control-plane for MediaCrawler-side operations.

Current scope:
- seed registry
- expansion registry
- durable query schedule state
- runtime policy profile
- fair platform planning with per-keyword caps
- first-party `trend_signal` export
- deterministic backtest for `seed -> schedule -> export`

## Commands

```bash
cd /Users/sourcefire/1data/scout-lab/scout-media-agents
npm run check
npm run backtest
npm run backtest -- --profile debug_fast
```

Backtest output is written under `state/backtests/<run_id>/` by default.

Key artifacts:
- `runtime/seeds.json`
- `runtime/expansion-registry.json`
- `runtime/query-schedule-states.round*.json`
- `handoff/trend_signal/current/trend_signal_latest.json`
- `handoff/trend_signal/current/trend_signal_latest.csv`

Seed input file:
- `config/trend-seeds.csv`

Planning behavior:
- respect `perPlatformLimit` from runtime policy
- respect `maxTasksPerKeyword` inside the same platform batch
- rotate across keyword groups before taking a second task from the same keyword

This package does not yet execute live MediaCrawler subprocesses. The first batch focuses on durable first-party state and export contracts so that live execution can be added without redesigning the control-plane.
