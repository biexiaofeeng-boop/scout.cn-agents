# Scout Runtime and Vendor Strategy

Date: 2026-05-14

## Positioning

Scout should own data acquisition and collection governance. Product layers such as GameLens should consume cleaned handoff data instead of running their own crawler fleet.

## Directory Roles

### `/Users/sourcefire/1data/scout-lab`

Source workspace.

- code
- provider wrappers
- topic configuration
- schemas
- runbooks
- tests

Runtime data should not be treated as source.

### `/Users/sourcefire/1data/scout`

Domain runtime data.

Recommended layout:

```text
/Users/sourcefire/1data/scout/
  topics/
    game/
      game-survivor-like-idle-rpg/
        raw/
          steam/
          youtube/
          reddit/
        normalized/
        handoff/
        reports/
    finance/
    ai/
    consumer/
  reports/
  logs/
```

This makes topic data portable across products while keeping source repositories clean.

### `scout-vendor`

Unified data acquisition boundary.

It should contain:

- first-party wrappers around official APIs
- first-party wrappers around public endpoints
- isolated third-party vendor code
- provider registry and provider-specific run instructions

It should not contain business-specific analysis logic.

### `scout-hub`

Aggregation and service boundary.

`scout-hub` should provide:

- ingest pipeline
- idempotency
- health, metrics, alerts
- read APIs over normalized events/signals
- optional run trigger APIs

It should not become the only place where topic runtime data lives. Topic data belongs under `/Users/sourcefire/1data/scout`.

### `scout-media-agents`

TopicOps and planning boundary.

It should own:

- topic catalog
- seed registry
- query expansion
- review approval
- query-unit planning
- trend-signal export contracts

### `GameLens`

Game growth analysis boundary.

It should consume:

- normalized evidence
- trend signals
- topic-level handoff packs

It should produce:

- opportunity cards
- creative briefs
- variant packs
- collection needs for Scout

## Crawler Governance

All crawlers and data connectors should be governed from `scout-vendor`, including current Chinese crawlers:

- `mediacrawler`: keep under `scout-vendor/mediacrawler`
- `wechat-spider`: keep current path for now, but register as provider `wechat-spider`
- future Steam/YouTube/Reddit connectors: implement in `scout-vendor/src/connectors`

Do not move `wechat-spider` until the Docker/runtime path is stable. First step is provider governance, not file relocation.

## First Game Providers

P0 providers:

- `steam`: public Steam Store/search/reviews endpoints
- `youtube`: official YouTube Data API, requires `YOUTUBE_API_KEY`
- `reddit`: public JSON search first, OAuth later if needed

Deferred providers:

- TikTok Creative Center: manual/link collector first
- Meta Ad Library: official API review first
- Google Ads Transparency: link evidence collector first
- App Store / Google Play: P1 after Steam/YouTube/Reddit works

## Open Source Vendor Policy

Third-party projects may be cloned for analysis, but should not be copied into the repo until:

1. license is known and compatible with intended use
2. the project is needed beyond what an official API/public endpoint gives
3. the wrapper interface is already defined
4. upstream source and commit are recorded

Recommended destination when vendoring is necessary:

```text
scout-vendor/<provider>/vendor/<upstream-project>/
scout-vendor/<provider>/SCOUT_VENDOR.md
```

For the first Steam/YouTube/Reddit loop, direct wrappers are sufficient.
