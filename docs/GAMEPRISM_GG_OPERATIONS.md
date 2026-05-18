# gameprism.gg Scout Operations

This runbook keeps `gameprism.gg` intelligence data outside the code repository and inside the Scout runtime tree.

## Runtime Layout

```text
/Users/sourcefire/1data/scout/projects/gameprism.gg/
  topics/
    game/<topic-id>/
      raw/<provider>/*.jsonl
      normalized/evidence.jsonl
      handoff/gamelens/evidence.json
      reports/latest.md
  handoff/
  reports/
  runs/
  review-queue/
```

Legacy/global Scout topics remain under:

```text
/Users/sourcefire/1data/scout/topics/
```

## Active Topics

The first operational batch is configured in `scout-media-agents/config/topics/scout-topics.json`:

- `gameprism.gg-language-games`
- `gameprism.gg-historical-mystery-games`
- `gameprism.gg-map-exploration-games`
- `gameprism.gg-ecology-systems-games`

Each topic has:

```json
{
  "projectId": "gameprism.gg",
  "dataSources": ["steam", "youtube", "reddit"],
  "refreshCadence": "weekly"
}
```

## Weekly Operating Loop

1. Open `http://127.0.0.1:18080/ops`.
2. Select one `gameprism.gg-*` topic.
3. Select providers:
   - `steam`
   - `reddit`
   - `youtube`
4. Start with `dry-run` only when checking wiring.
5. For live update, run `Collect + Normalize` without `dry-run`.
6. Review the generated item in `Review Queue`.
7. Approve only if the signal is useful for editorial planning.
8. Use the topic report under the project runtime folder to update:
   - Game detail copy
   - topic-page deep dives
   - Prism Notes candidates
   - playable ideas

## Frequency

Recommended initial cadence:

- `steam`: weekly
- `reddit`: weekly
- `youtube`: weekly or every two weeks if API quota becomes tight

Do not schedule all game entries individually yet. Start from the four editorial topic pages and split into game-level topics only when a specific page needs deeper monitoring.

## YouTube Key

`YOUTUBE_API_KEY` must be present in:

```text
/Users/sourcefire/1data/scout-lab/scout-deploy/env/scout-hub.env
```

After changing it:

```bash
cd /Users/sourcefire/1data/scout-lab/scout-deploy
./docker-up.sh
./docker-status.sh
```

Check provider readiness:

```bash
curl -sS http://127.0.0.1:18080/ops/overview.json | jq '.providers[] | select(.id=="youtube")'
```
