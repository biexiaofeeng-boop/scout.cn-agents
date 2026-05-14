# scout-vendor

`scout-vendor` is Scout's unified data acquisition boundary.

It contains first-party provider wrappers, isolated third-party crawler code, provider registry metadata, and operational notes for collecting raw evidence. Business analysis, topic governance, and product-specific reasoning should stay outside this package.

中文简述：`scout-vendor` 是所有数据获取能力的统一入口，避免 crawler 分散在不同产品目录里。

## Responsibilities

`scout-vendor` should:

- register every data provider in a single provider registry
- expose a consistent collection interface
- write raw evidence records into the Scout runtime topic layout
- keep provider authentication and operational notes close to provider code
- preserve third-party vendor license and upstream source information
- prefer small wrappers around official/public endpoints before copying external crawler projects

`scout-vendor` should not:

- own topic strategy or keyword approval
- own product-specific analysis logic
- write runtime data into git-tracked folders
- silently modify third-party vendor code without recording the reason

## Current Providers

| Provider | Type | Status | Env | Output | Notes |
| --- | --- | --- | --- | --- | --- |
| `steam` | Public endpoint wrapper | Ready | none | `vendor_evidence_v1` | Steam store search and app reviews. |
| `youtube` | Official API wrapper | Needs key | `YOUTUBE_API_KEY` | `vendor_evidence_v1` | YouTube Data API search. Comments/transcripts can be added later. |
| `reddit` | Public JSON wrapper | Ready | none | `vendor_evidence_v1` | Reddit public search. OAuth can be added later if needed. |
| `mediacrawler` | Third-party vendor crawler | Ready | platform/runtime dependent | `vendor_evidence_v1` adapter target | CN platforms: Xiaohongshu, Douyin, Bilibili, Weibo, Zhihu, Tieba, Kuaishou. |
| `wechat-spider` | Existing crawler runtime | Ready | `WECHAT_MYSQL_PASSWD` and Docker env | `vendor_evidence_v1` adapter target | Registered as provider; physical move is deferred to protect current runtime stability. |

Provider registry source:

```text
scout-vendor/src/providers.ts
```

Provider selection and vendoring notes:

```text
scout-vendor/PROVIDER_EVALUATION.md
```

## Runtime Output

Default output root:

```text
/Users/sourcefire/1data/scout/topics/<vertical>/<topic-id>/raw/<provider>/
```

Example:

```text
/Users/sourcefire/1data/scout/topics/game/game-survivor-like-idle-rpg/raw/steam/<run_id>.jsonl
/Users/sourcefire/1data/scout/topics/game/game-survivor-like-idle-rpg/raw/steam/<run_id>.manifest.json
```

Raw records use the internal `VendorEvidenceRecord` shape from `src/types.ts`.

Downstream normalization should produce product-safe outputs under:

```text
/Users/sourcefire/1data/scout/topics/<vertical>/<topic-id>/normalized/
/Users/sourcefire/1data/scout/topics/<vertical>/<topic-id>/handoff/
```

## Commands

Install and type-check:

```bash
cd /Users/sourcefire/1data/scout-lab/scout-vendor
npm install
npm run check
```

List providers:

```bash
npm run providers:list
```

Collect Steam search results:

```bash
npm run collect -- --provider steam --topic-id game-survivor-like-idle-rpg --query "survivor" --limit 3
```

Collect Steam app reviews:

```bash
npm run collect -- --provider steam --topic-id game-survivor-like-idle-rpg --query "Vampire Survivors reviews" --app-id 1794680 --limit 10
```

Collect Reddit public search results:

```bash
npm run collect -- --provider reddit --topic-id game-survivor-like-idle-rpg --query "survivor-like idle RPG" --limit 3
```

Collect YouTube search results:

```bash
YOUTUBE_API_KEY=... npm run collect -- --provider youtube --topic-id game-survivor-like-idle-rpg --query "survivor-like idle RPG" --limit 3
```

Override runtime root when needed:

```bash
SCOUT_RUNTIME_ROOT=/Users/sourcefire/1data/scout npm run collect -- --provider steam --topic-id game-survivor-like-idle-rpg --query "survivor" --limit 3
```

Dry run without network collection:

```bash
npm run collect -- --provider steam --topic-id game-survivor-like-idle-rpg --query "survivor" --limit 3 --dry-run
```

## Open Source Crawler Policy

External repositories can be cloned for analysis. Do not copy them into the maintained source tree by default.

Vendoring is allowed only when:

- the direct wrapper path is insufficient
- license is known and compatible with the intended use
- upstream repository and commit are recorded
- adapter interface is already defined
- runtime data remains outside git
- maintenance owner and rollback plan are clear

Preferred layout:

```text
scout-vendor/<provider>/vendor/<upstream-project>/
scout-vendor/<provider>/SCOUT_VENDOR.md
```

For the first overseas game intelligence loop, Steam/YouTube/Reddit use direct wrappers. This is intentional: fewer moving parts, clearer TypeScript contracts, and lower maintenance risk.

## MediaCrawler Boundary

`scout-vendor/mediacrawler/` was copied from the BeautyQA vendor workspace so Scout can modify it without affecting the school project.

Rules:

- preserve upstream license and notices
- keep `.venv`, login state, cookies, generated data, and runtime artifacts out of git
- prefer adapter scripts and wrapper commands before changing vendor internals
- document any local patch in `scout-vendor/mediacrawler/SCOUT_VENDOR.md`

## WeChat Boundary

`wechat-spider/` is operational through the Docker stack and should be governed as provider `wechat-spider` before being moved physically.

Do not relocate it until:

- Docker paths are updated and tested
- database/env contracts are stable
- rollback steps are documented
- `scout-vendor` has a working adapter around its outputs

## README Maintenance

Update this README whenever provider behavior changes.

Required updates include:

- new provider added or removed
- provider status changed
- new env key required
- raw output path or schema changed
- vendored third-party code added
- operational command changed
- known provider risk changes materially
