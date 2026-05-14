# Provider Evaluation

Date: 2026-05-14

## Decision

For the first overseas game intelligence loop, do not vendor third-party crawler repositories yet.

Use first-party wrappers around stable official or public endpoints:

- `steam`: Steam Store search and app reviews endpoints
- `youtube`: YouTube Data API
- `reddit`: public JSON search first, OAuth/PRAW later if required

This keeps the provider boundary small and avoids early license/maintenance drift.

## P0 Providers

### Steam

Decision: implement directly.

Reason:

- Steam exposes a JSON app reviews endpoint.
- Store search is also enough for initial competitor discovery evidence.
- Third-party packages add little value for the first loop.

When to vendor:

- Need bulk pagination, cursor recovery, retries, or app-id enrichment beyond the direct wrapper.

Candidate references:

- `steam-reviews` Python package
- Steam review scraper repositories
- SteamSpy or Steam Web API wrappers for market sizing

### YouTube

Decision: use official YouTube Data API first.

Reason:

- Search API gives stable video discovery.
- It has clear key/quota semantics.
- Scraping comments/transcripts can come later after query shape and quota budget are known.

Required env:

- `YOUTUBE_API_KEY`

When to vendor:

- Need transcript extraction or comment crawling not covered by official API economics.
- Need a local cache and quota-aware batching helper.

### Reddit

Decision: start with public JSON search; move to OAuth/PRAW if Reddit becomes a core source.

Reason:

- Public search is sufficient for early topic smoke tests.
- PRAW is the right long-term library if we need authenticated access, rate-limit handling, comments, submissions, and subreddit workflows.

When to vendor:

- Do not vendor PRAW source; add it as a Python dependency if needed.
- If using Node, write a small official API/OAuth wrapper.

## P1 Providers

### Google Play

Decision: defer.

Candidate:

- `JoMingyu/google-play-scraper` is MIT licensed and actively used for Python-based Google Play app/review extraction.

Risk:

- Store throttling and app-region behavior need operational safeguards.

### Apple App Store

Decision: defer.

Candidate:

- npm `app-store-scraper`

Risk:

- Region/storefront handling and review pagination need testing.

## P2 Providers

### TikTok Creative Center

Decision: manual/link collector first.

Reason:

- Useful for ad intelligence, but automated scraping is more brittle and more likely to trigger account/ToS issues.

### Meta Ad Library

Decision: official API review first.

Reason:

- High value for ad evidence, but should not be treated as a casual scraper.

## Vendoring Rules

Only clone or copy a third-party project into `scout-vendor` when:

1. direct official/public wrapper is insufficient
2. license is known
3. upstream commit is recorded
4. provider wrapper interface already exists
5. runtime data remains outside git

Preferred layout:

```text
scout-vendor/<provider>/vendor/<upstream-project>/
scout-vendor/<provider>/SCOUT_VENDOR.md
```
