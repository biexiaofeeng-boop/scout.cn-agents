#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/scout-deploy"

pass_count=0
warn_count=0
fail_count=0

pass() { pass_count=$((pass_count+1)); echo "[PASS] $*"; }
warn() { warn_count=$((warn_count+1)); echo "[WARN] $*"; }
fail() { fail_count=$((fail_count+1)); echo "[FAIL] $*"; }

read_env() {
  local file="$1"
  local key="$2"
  awk -F= -v k="$key" '$1==k {sub(/^[[:space:]]+/, "", $2); sub(/[[:space:]]+$/, "", $2); print $2; exit}' "$file"
}

check_cmd() {
  local c="$1"
  if command -v "$c" >/dev/null 2>&1; then
    pass "command '$c' found"
  else
    fail "command '$c' missing"
  fi
}

check_port() {
  local p="$1"
  if command -v lsof >/dev/null 2>&1; then
    if lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
      warn "port $p is in use"
    else
      pass "port $p available"
    fi
  else
    warn "lsof missing; skip port check"
  fi
}

echo "[INFO] checking deploy baseline in $ROOT_DIR"

check_cmd node
check_cmd npm
check_cmd curl

for d in "$ROOT_DIR/scout-hub" "$ROOT_DIR/scout-media-agents" "$ROOT_DIR/scout-wchat-agents"; do
  if [ -f "$d/package.json" ]; then
    pass "project exists: $d"
  else
    fail "project missing: $d"
  fi
  if [ -d "$d/node_modules" ]; then
    pass "dependencies installed: $d"
  else
    warn "dependencies not installed: $d"
  fi
done

for f in "$DEPLOY_DIR/env/scout-hub.env" "$DEPLOY_DIR/env/scout-media.env" "$DEPLOY_DIR/env/scout-wchat.env"; do
  if [ -f "$f" ]; then
    pass "env file exists: $f"
  else
    fail "env file missing: $f"
  fi
done

if [ -f "$DEPLOY_DIR/env/scout-hub.env" ]; then
  hub_pwd="$(read_env "$DEPLOY_DIR/env/scout-hub.env" WECHAT_MYSQL_PASSWD)"
  if [ -z "$hub_pwd" ] || echo "$hub_pwd" | grep -qi 'CHANGE_ME'; then
    warn "scout-hub mysql password still placeholder"
  else
    pass "scout-hub mysql password configured"
  fi
fi

if [ -f "$DEPLOY_DIR/env/scout-wchat.env" ]; then
  w_pwd="$(read_env "$DEPLOY_DIR/env/scout-wchat.env" WECHAT_MYSQL_PASSWD)"
  if [ -z "$w_pwd" ] || echo "$w_pwd" | grep -qi 'CHANGE_ME'; then
    warn "scout-wchat mysql password still placeholder"
  else
    pass "scout-wchat mysql password configured"
  fi
fi

check_port 18080
check_port 8080
check_port 3306

echo "========== SUMMARY =========="
echo "PASS: $pass_count"
echo "WARN: $warn_count"
echo "FAIL: $fail_count"

if [ "$fail_count" -gt 0 ]; then
  exit 2
fi
