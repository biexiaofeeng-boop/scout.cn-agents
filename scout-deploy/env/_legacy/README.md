# Legacy env files (do not commit)

These three env files lived under `scout-lab/ops/env/` in the
intel_hub era. `ops/` was removed in commit `6544d78` because
scout-deploy fully replaced it. These files moved here on
2026-05-21 so we don't lose any configuration silently.

| File | Origin | Still useful? |
|---|---|---|
| `intel_hub.env` | intel_hub runtime settings (DB path, mediacrawler/wechat root pointers). intel_hub itself was removed in commit `e1d53ea`. | No — kept only for value reference. |
| `mediacrawler.env` | MediaCrawler API security (`MEDIACRAWLER_API_KEY`, `MEDIACRAWLER_API_AUTH_ENABLED`, etc.) plus a separate MySQL config. The current scout-deploy stack does NOT consume these. | Maybe — if MediaCrawler API auth is re-enabled, the key here is the historical value. |
| `wechat.env` | Wechat-spider docker-compose variables. The `WECHAT_MYSQL_PASSWD` here (`gbiB_…`) is a different value than the one in `scout-deploy/env/scout-ops.env` (`4mV@…`), so they are not interchangeable. | Maybe — depends on which mariadb instance the operator is targeting. |

These files are **gitignored** (the wider `.gitignore` already excludes `*.env`). If you want to permanently delete them, do it when you have decided that none of the embedded secrets are still in use somewhere.

To delete the whole legacy folder once you have confirmed none of these values are still needed:

```bash
rm -rf scout-deploy/env/_legacy
```
