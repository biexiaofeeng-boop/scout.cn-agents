# scout-vendor

This directory is the unified data acquisition boundary for Scout. It holds
third-party vendor components and first-party wrappers around official APIs or
public endpoints.

Current vendor packages:
- `mediacrawler/`: copied from `/Users/sourcefire/1data/workspace-ln/BeautyModel-Lab/BeautyQA-vendor/MediaCrawler`

Current first-party provider wrappers:
- `steam`: Steam store search and review endpoints
- `youtube`: YouTube Data API search, requires `YOUTUBE_API_KEY`
- `reddit`: Reddit public JSON search

Rules:
- do not assume vendor code is first-party
- preserve upstream license files and notices
- keep runtime state out of git
- prefer wrappers, adapters, and orchestration around vendor code before deep edits

Runtime output defaults to `/Users/sourcefire/1data/scout/topics/<vertical>/<topic-id>/raw/<provider>/`.

Provider selection notes: `PROVIDER_EVALUATION.md`

Commands:

```bash
cd /Users/sourcefire/1data/scout-lab/scout-vendor
npm install
npm run providers:list
npm run collect -- --provider steam --topic-id game-survivor-like-idle-rpg --query "survivor-like idle RPG" --limit 5
npm run collect -- --provider reddit --topic-id game-survivor-like-idle-rpg --query "survivor-like idle RPG" --limit 5
YOUTUBE_API_KEY=... npm run collect -- --provider youtube --topic-id game-survivor-like-idle-rpg --query "survivor-like idle RPG" --limit 5
```
