# Scout Intelligence Agents

Scout is an intelligence collection and governance system for turning topic needs into auditable data collection, normalized evidence, trend signals, and downstream product handoff.

It is not just a crawler folder. The intended system boundary is:

```text
topic need -> seed registry -> expansion -> reviewed query plan -> provider collection -> raw runtime data -> normalized evidence -> trend signal / handoff -> product analysis
```

Current priority domains:

- Chinese-world intelligence: WeChat, Douyin, Bilibili, Xiaohongshu, Weibo, Zhihu, Tieba, Kuaishou through existing vendor crawlers.
- Overseas game intelligence: Steam, YouTube, Reddit as the first stable channel set for GameLens and game market research.
- Future verticals: AI, finance, consumer, game, and other topic-driven intelligence operations.

中文简述：Scout 的目标是搭建一个“情报收集 Agents 体系”，不是单一爬虫项目。它负责把主题需求拆成可审阅、可调度、可追踪、可导出的数据采集闭环。

## Repository Map

| Path | Role | Current status |
| --- | --- | --- |
| `scout-vendor/` | Unified data acquisition boundary. Owns first-party provider wrappers and isolated third-party crawler code. | Active. Contains MediaCrawler and Steam/YouTube/Reddit wrappers. |
| `scout-media-agents/` | TopicOps control plane. Owns topic catalog, seeds, expansion, review, schedule planning, and trend-signal export contracts. | Active TypeScript package. |
| `scout-hub/` | Aggregation/API/health/metrics boundary for normalized events and pipeline operations. | Active TypeScript service. |
| `scout-wchat-agents/` | TypeScript adapter/control-plane work around WeChat collection. | Active adapter package. |
| `wechat-spider/` | Existing WeChat crawler runtime. | Operational, but not physically moved under `scout-vendor` yet to avoid destabilizing Docker/runtime paths. |
| `scout-deploy/` | Docker-based local runtime stack and service scripts. | Operational for local MySQL, Redis, hub, scheduler, and WeChat spider. |
| `ops/` | Lightweight scan/start/status/stop helper scripts. | Legacy/simple local ops entry. |
| `docs/` | Architecture, migration, operation, and issue-check documentation. | Active collaboration source. |

Runtime/domain data should live outside this repository by default:

```text
/Users/sourcefire/1data/scout/
  topics/<vertical>/<topic-id>/raw/<provider>/
  topics/<vertical>/<topic-id>/normalized/
  topics/<vertical>/<topic-id>/handoff/
  reports/
  logs/
```

中文补充：`scout-lab` 放代码、配置、文档；`/Users/sourcefire/1data/scout` 放运行时 topic 数据、原始采集、清洗结果和 handoff。

## System Responsibilities

### 1. TopicOps Governance

Owned mainly by `scout-media-agents`.

- Maintain topic catalog by vertical, market, language, intent, cadence, and data sources.
- Maintain seed registry for human-approved starting points.
- Expand keywords using deterministic and LLM-assisted expansion.
- Review and approve query candidates before scheduled collection.
- Produce query-unit schedule state and trend-signal handoff artifacts.

This layer decides what should be collected and why.

### 2. Data Acquisition

Owned by `scout-vendor`.

- Register every crawler/provider in one provider registry.
- Prefer official APIs or stable public endpoints before vendoring third-party crawler projects.
- Keep third-party vendor code isolated with upstream license and source notes.
- Write provider output as raw evidence records under runtime topic folders.
- Keep provider-specific authentication, rate limit, and operational notes close to the provider.

This layer collects data but should not own business analysis logic.

### 3. Aggregation And Service Operations

Owned mainly by `scout-hub` and `scout-deploy`.

- Provide health, metrics, alert, and pipeline status endpoints.
- Support ingest, idempotency, retry, DLQ, and scheduler operations.
- Expose stable service APIs where useful.
- Keep Docker-based local service startup reproducible.

This layer keeps the system observable and operable.

### 4. Product Handoff

Product systems such as GameLens should not own crawler fleets.

Scout should provide:

- normalized evidence
- trend signals
- topic-level handoff packs
- run manifests and provenance

GameLens or other products should consume cleaned Scout outputs and return new `CollectionNeed` requests when more data is required.

中文补充：GameLens 更适合消费 Scout 清洗后的 evidence/trend signal，不应该直接管理 crawler。

## Current Channel Capability

| Provider | Source type | Vertical fit | Status | Notes |
| --- | --- | --- | --- | --- |
| `steam` | Public endpoint wrapper | Game | Ready | Store search and app review collection. Good first source for competitor discovery and player review evidence. |
| `youtube` | Official API wrapper | Game, AI, finance | Needs key | Requires `YOUTUBE_API_KEY`. Good for video discovery and creator/content signals. |
| `reddit` | Public JSON wrapper | Game, AI, finance | Ready | Good for community discussion smoke tests. OAuth can be added later if Reddit becomes core. |
| `mediacrawler` | Vendor crawler | CN social/content platforms | Ready | Covers Xiaohongshu, Douyin, Bilibili, Weibo, Zhihu, Tieba, Kuaishou. Login and anti-bot behavior must be operated carefully. |
| `wechat-spider` | Vendor crawler/runtime service | WeChat | Ready | Operational through Docker stack. Governed as provider, physical relocation deferred. |
| `industry_news` | Planned/manual or wrapper | AI, finance, consumer | Planned | Useful for source-controlled topic monitoring. |

First overseas game loop:

- `survivor-like idle RPG`
- `historical exploration game`
- `creature evolution game`
- `geo-history puzzle game`
- `cozy strategy game`
- `mythology roguelite`

Initial channels: Steam, YouTube, Reddit. Do not start with TikTok/Meta automation until governance, compliance, and account-risk boundaries are clearer.

## Quick Start

### Install and validate TopicOps

```bash
cd /Users/sourcefire/1data/scout-lab/scout-media-agents
npm install
npm run check
npm run cli -- topics:list
npm run backtest -- --skip-llm
```

### Install and validate provider wrappers

```bash
cd /Users/sourcefire/1data/scout-lab/scout-vendor
npm install
npm run check
npm run providers:list
npm run collect -- --provider steam --topic-id game-survivor-like-idle-rpg --query "survivor" --limit 3
npm run collect -- --provider reddit --topic-id game-survivor-like-idle-rpg --query "survivor-like idle RPG" --limit 3
YOUTUBE_API_KEY=... npm run collect -- --provider youtube --topic-id game-survivor-like-idle-rpg --query "survivor-like idle RPG" --limit 3
npm run normalize -- --topic-id game-survivor-like-idle-rpg --vertical game
```

Default runtime output:

```text
/Users/sourcefire/1data/scout/topics/<vertical>/<topic-id>/raw/<provider>/
/Users/sourcefire/1data/scout/topics/<vertical>/<topic-id>/normalized/evidence.jsonl
/Users/sourcefire/1data/scout/topics/<vertical>/<topic-id>/handoff/gamelens/evidence.json
/Users/sourcefire/1data/scout/topics/<vertical>/<topic-id>/reports/latest.md
```

### Start the Docker runtime stack

```bash
cd /Users/sourcefire/1data/scout-lab/scout-deploy
./docker-check.sh
./docker-up.sh
./docker-status.sh
```

Expected local probes include:

- `http://127.0.0.1:18080/health`
- `http://127.0.0.1:18080/metrics`
- `http://127.0.0.1:18080/alerts`
- `http://127.0.0.1:18080/ops`

The Ops Console supports guarded SO2 actions for known topics and allowlisted providers:

- `POST /ops/runs/collect-topic`
- `POST /ops/runs/normalize-topic`
- `POST /ops/runs/collect-and-normalize-topic`
- `GET /ops/runs/<run-id>`
- `GET /ops/runs/<run-id>/logs`
- `POST /ops/runs/<run-id>/retry`
- `POST /ops/runs/cleanup`
- `GET /ops/review-queue`
- `POST /ops/review-queue/<review-id>/decision`

Run records are persisted under `/Users/sourcefire/1data/scout/runs/<run-id>/`. Review queue records are persisted under `/Users/sourcefire/1data/scout/review-queue/`. Collection output still lands under `/Users/sourcefire/1data/scout/topics/...`.

## Governance Flow

Use this as the default operating loop:

1. Create or update a topic in `scout-media-agents/config/topics/scout-topics.json`.
2. Add human-approved seeds in `scout-media-agents/config/trend-seeds.csv`.
3. Run expansion and backtest in `scout-media-agents`.
4. Review generated query units before running large collection.
5. Collect through registered providers in `scout-vendor` or the guarded `/ops` actions.
6. Store raw data under `/Users/sourcefire/1data/scout/topics/.../raw/...`.
7. Normalize raw provider records into evidence/trend-signal handoff formats.
8. Review normalized outputs in the Ops review queue.
9. Let downstream products consume only approved normalized/handoff outputs.
10. Feed new collection needs back into TopicOps instead of creating crawler scripts elsewhere.

中文补充：正式运营不要“随便爬”。先定义 topic，再扩词，再审阅 query，再采集归一化，再 review，最后才进入后续调度和 handoff。

## Open Source Vendor Policy

Third-party crawler projects may be cloned for analysis, but should only be copied into this repository when all conditions are met:

- direct official/public wrapper is insufficient
- license is known and compatible with intended use
- upstream repository and commit are recorded
- provider wrapper interface already exists
- runtime data remains outside git
- maintenance owner is assigned

Preferred layout when vendoring is necessary:

```text
scout-vendor/<provider>/vendor/<upstream-project>/
scout-vendor/<provider>/SCOUT_VENDOR.md
```

For the current Steam/YouTube/Reddit loop, direct wrappers are the default path. This keeps the system smaller, easier to type-check, and easier to maintain.

## README Update Rules

Any material capability change must update README files in the same commit.

Update the root `README.md` when changing:

- system positioning
- directory responsibility
- provider/channel status
- core governance flow
- runtime data layout
- quick-start commands
- licensing boundaries

Update `scout-vendor/README.md` when changing:

- provider registry
- provider commands
- env requirements
- raw output schema or location
- third-party vendoring status

Update `scout-media-agents/README.md` when changing:

- topic schema
- seed/expansion/review/schedule flow
- trend-signal or handoff contracts
- TopicOps CLI commands

See `docs/README_UPDATE_GUIDELINES.md` for the detailed checklist.

## Key Docs

- `docs/SCOUT_RUNTIME_AND_VENDOR_STRATEGY.md`: source/runtime boundary and vendor strategy.
- `docs/AGENTS_SYSTEM_BLUEPRINT.md`: agents system blueprint.
- `docs/TS_MIGRATION_STAGES.md`: TypeScript migration plan.
- `docs/BEAUTYQA_TRENDAGENT_INTEGRATION.md`: BeautyQA TrendAgent integration analysis.
- `docs/Issue-Checks/`: task packages, checks, handoff templates, and execution tracking.
- `scout-vendor/PROVIDER_EVALUATION.md`: provider selection and vendoring policy.

## License Boundary

- First-party Scout control-plane code, adapters, deployment scripts, documentation, and operations scripts are released under Apache-2.0. See `LICENSE`.
- `scout-vendor/mediacrawler/` preserves its upstream `NON-COMMERCIAL LEARNING LICENSE 1.1`. See `scout-vendor/mediacrawler/LICENSE`.
- `wechat-spider/` did not have a confirmed Apache-compatible upstream license in the current snapshot and is not included in first-party Apache-2.0 relicensing.
- See `NOTICE` for detailed boundaries.
