# scout-media-agents

`scout-media-agents` is Scout's TopicOps and planning control plane.

It turns human topic intent into seed registries, keyword expansion, reviewable query units, schedule state, and trend-signal export contracts. It should decide what to collect and why; live provider execution belongs to `scout-vendor`.

中文简述：`scout-media-agents` 负责 topic 治理，不负责把所有 crawler 逻辑塞进来。

## Current Scope

- topic catalog by vertical, market, language, intent, cadence, and data sources
- seed registry from `config/trend-seeds.csv`
- deterministic and LLM-assisted expansion hooks
- topic, review, and query-unit governance snapshots
- durable query schedule state
- runtime policy profiles
- fair platform planning with per-keyword caps
- first-party `trend_signal` export
- deterministic backtest for `seed -> expansion -> review -> schedule -> export`

This package does not yet execute live provider subprocesses. Provider execution should be called through `scout-vendor` after query plans are reviewed.

## Data Governance Flow

```text
topic -> seed -> expansion -> review -> query unit -> schedule state -> provider collection -> normalized evidence -> trend signal / handoff
```

Operational meaning:

1. Define topic scope in `config/topics/scout-topics.json`.
2. Add approved seeds in `config/trend-seeds.csv`.
3. Generate expansions.
4. Review and approve query candidates.
5. Plan due query units by runtime policy.
6. Send approved collection tasks to provider wrappers in `scout-vendor`.
7. Export trend signals and handoff artifacts.

## Current Topic Coverage

Chinese intelligence topics:

- AI agents
- 美以伊朗
- 中东战况
- 健康食品

Overseas game topics:

- survivor-like idle RPG
- historical exploration game
- creature evolution game
- geo-history puzzle game
- cozy strategy game
- mythology roguelite

The first game channel set is Steam, YouTube, and Reddit.

## Commands

```bash
cd /Users/sourcefire/1data/scout-lab/scout-media-agents
npm install
npm run check
npm run backtest
npm run backtest -- --profile debug_fast
npm run backtest -- --skip-llm
npm run cli -- topics:list
npm run cli -- review:list --status pending
npm run cli -- plan:next --limit 5
npm run cli -- runs:list --limit 5
```

Backtest output is written under:

```text
state/backtests/<run_id>/
```

Governance snapshots are refreshed under `state/registries/` when governance CLI commands run:

```text
topics.snapshot.json
seeds.snapshot.json
review.snapshot.json
query-units.snapshot.json
```

Key runtime artifacts:

```text
runtime/seeds.json
runtime/expansion-registry.json
runtime/query-schedule-states.round*.json
handoff/trend_signal/current/trend_signal_latest.json
handoff/trend_signal/current/trend_signal_latest.csv
```

Seed input file:

```text
config/trend-seeds.csv
```

Topic input file:

```text
config/topics/scout-topics.json
```

## Planning Behavior

The planner should:

- respect `perPlatformLimit` from runtime policy
- respect `maxTasksPerKeyword` inside the same platform batch
- rotate across keyword groups before taking a second task from the same keyword
- keep high-risk or account-sensitive platforms behind explicit runtime policy
- treat Steam/YouTube/Reddit as the first overseas game loop

## Boundary With scout-vendor

`scout-media-agents` produces reviewed query intent. `scout-vendor` executes provider-specific collection.

Do not add new crawler implementations here unless they are temporary prototypes. If a source becomes operational, move it into `scout-vendor` or register it there.

## README Maintenance

Update this README whenever TopicOps behavior changes.

Required updates include:

- topic schema changes
- seed CSV schema changes
- expansion behavior changes
- review or schedule state changes
- new CLI command added
- trend-signal or handoff format changes
- platform/runtime policy behavior changes
