# README Update Guidelines

Date: 2026-05-14

Scout is becoming an intelligence agents system, so README files must describe the operating model, not only local commands.

中文简述：README 是协作入口，不只是命令备忘录。任何能力变化都要同步更新，避免团队只看到局部 crawler 或旧部署方式。

## Language Rule

Use English as the primary README language.

Add short Chinese supplements when:

- a concept is critical for local collaboration
- the operational risk is easier to explain in Chinese
- the term maps to a Chinese-world intelligence workflow

Do not maintain two divergent full versions.

## Root README Scope

Update `/Users/sourcefire/1data/scout-lab/README.md` when changing:

- system positioning
- repository map
- source/runtime data boundary
- provider/channel capability table
- governance flow
- quick-start commands
- Docker/runtime service assumptions
- downstream product handoff contract
- license boundary

The root README should answer:

- What is Scout?
- What problem does it solve?
- Which directory owns which responsibility?
- Which channels are currently usable?
- How does a topic move from seed to handoff?
- Where does runtime data live?
- What should a new contributor read next?

## scout-vendor README Scope

Update `/Users/sourcefire/1data/scout-lab/scout-vendor/README.md` when changing:

- provider list or provider status
- provider env requirements
- provider command examples
- raw output schema or location
- third-party vendoring status
- provider risk or compliance notes
- MediaCrawler or WeChat boundary assumptions

It should not describe product strategy except where needed to explain provider priority.

## scout-media-agents README Scope

Update `/Users/sourcefire/1data/scout-lab/scout-media-agents/README.md` when changing:

- topic schema
- seed schema
- expansion behavior
- review state behavior
- schedule state behavior
- runtime policy behavior
- trend-signal export contract
- TopicOps CLI commands

It should describe planning and governance, not crawler internals.

## Required Commit Discipline

If a code change changes how the system is operated, include README updates in the same commit.

Examples:

- New provider connector: update root README provider table and `scout-vendor/README.md`.
- New topic vertical: update root README priority domains and TopicOps docs if schema changed.
- New handoff format: update root README flow and the package README that produces it.
- New Docker port/env: update root README quick start and deployment docs.
- Moving crawler files: update root README repository map, `scout-vendor/README.md`, and `NOTICE` if license scope changes.

## Avoid These README Failures

- Describing Scout as only a crawler collection.
- Hiding runtime data paths inside scripts only.
- Adding a provider without env and output examples.
- Mixing vendor crawler internals with TopicOps strategy.
- Forgetting license boundaries for copied third-party projects.
- Leaving Chinese-only operational notes where overseas collaborators need the system picture.

## Minimal Review Checklist

Before merging README-affecting work, check:

- system role is still accurate
- directory ownership is still accurate
- commands still run or are marked as planned
- provider status is not overstated
- env keys are named but secret values are not committed
- runtime data stays outside git
- downstream handoff expectations are clear
