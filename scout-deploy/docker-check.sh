#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/scout-deploy"

pass=0
warn=0
fail=0

ok(){ pass=$((pass+1)); echo "[PASS] $*"; }
ng(){ fail=$((fail+1)); echo "[FAIL] $*"; }
wa(){ warn=$((warn+1)); echo "[WARN] $*"; }

if command -v docker >/dev/null 2>&1; then ok "docker command exists"; else ng "docker command missing"; fi
if docker info >/dev/null 2>&1; then ok "docker daemon running"; else ng "docker daemon not running"; fi

for f in "$DEPLOY_DIR/env/scout-hub.env" "$DEPLOY_DIR/env/scout-wchat.env"; do
  if [ -f "$f" ]; then ok "env exists: $f"; else ng "env missing: $f"; fi
done

if [ -f "$DEPLOY_DIR/env/scout-hub.env" ] && [ -f "$DEPLOY_DIR/env/scout-wchat.env" ]; then
  hub_pwd=$(awk -F= '/^WECHAT_MYSQL_PASSWD=/{print $2; exit}' "$DEPLOY_DIR/env/scout-hub.env")
  wc_pwd=$(awk -F= '/^WECHAT_MYSQL_PASSWD=/{print $2; exit}' "$DEPLOY_DIR/env/scout-wchat.env")
  if [ "$hub_pwd" = "$wc_pwd" ] && [ -n "$hub_pwd" ] && ! echo "$hub_pwd" | grep -qi 'CHANGE_ME'; then
    ok "mysql password aligned between scout-hub and scout-wchat"
  else
    wa "mysql password mismatch or placeholder; edit env files before go-live"
  fi
fi

if [ "$fail" -gt 0 ]; then
  echo "SUMMARY pass=$pass warn=$warn fail=$fail"
  exit 2
fi

echo "SUMMARY pass=$pass warn=$warn fail=$fail"
