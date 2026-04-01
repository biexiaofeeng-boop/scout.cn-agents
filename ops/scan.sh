#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MEDIA_DIR="$ROOT_DIR/MediaCrawler"
WECHAT_DIR="$ROOT_DIR/wechat-spider"
INTEL_DIR="$ROOT_DIR/intel_hub"
RUNTIME_DIR="$ROOT_DIR/runtime"

fail_count=0
warn_count=0
pass_count=0

color() {
  local c="$1"; shift
  if [ -t 1 ]; then
    printf "\033[%sm%s\033[0m\n" "$c" "$*"
  else
    printf "%s\n" "$*"
  fi
}

pass() { pass_count=$((pass_count+1)); color "32" "[PASS] $*"; }
warn() { warn_count=$((warn_count+1)); color "33" "[WARN] $*"; }
fail() { fail_count=$((fail_count+1)); color "31" "[FAIL] $*"; }
info() { color "36" "[INFO] $*"; }
lower() { echo "$1" | tr '[:upper:]' '[:lower:]'; }

check_cmd() {
  local cmd="$1"
  if command -v "$cmd" >/dev/null 2>&1; then
    pass "command '$cmd' found: $(command -v "$cmd")"
  else
    fail "command '$cmd' missing"
  fi
}

check_optional_cmd() {
  local cmd="$1"
  if command -v "$cmd" >/dev/null 2>&1; then
    pass "optional command '$cmd' found: $(command -v "$cmd")"
  else
    warn "optional command '$cmd' missing"
  fi
}

check_python_version() {
  local ver
  ver="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")')"
  local major minor
  major="${ver%%.*}"
  minor="$(echo "$ver" | cut -d. -f2)"
  if [ "$major" -gt 3 ] || { [ "$major" -eq 3 ] && [ "$minor" -ge 11 ]; }; then
    pass "python3 version ok: $ver"
  else
    fail "python3 >= 3.11 required, current: $ver"
  fi
}

check_file_exists() {
  local path="$1"
  local label="$2"
  if [ -f "$path" ]; then
    pass "$label exists: $path"
  else
    warn "$label missing: $path"
  fi
}

read_env_value() {
  local file="$1"
  local key="$2"
  if [ ! -f "$file" ]; then
    echo ""
    return
  fi
  awk -F= -v k="$key" '$1==k {sub(/^[[:space:]]+/, "", $2); sub(/[[:space:]]+$/, "", $2); print $2; exit}' "$file"
}

check_python_modules() {
  local python_bin="$1"
  local label="$2"
  shift 2
  local modules=("$@")

  if [ ! -x "$python_bin" ]; then
    warn "$label python not found: $python_bin"
    return
  fi

  "$python_bin" - "${modules[@]}" <<'PY' >/tmp/codex_scan_mods.txt 2>/dev/null || true
import importlib.util as u
import sys
mods = sys.argv[1:]
print({m: bool(u.find_spec(m)) for m in mods})
PY
  if [ ! -s /tmp/codex_scan_mods.txt ]; then
    warn "$label modules check failed"
  elif grep -q "False" /tmp/codex_scan_mods.txt; then
    warn "$label modules incomplete: $(cat /tmp/codex_scan_mods.txt)"
  else
    pass "$label modules ready: $(cat /tmp/codex_scan_mods.txt)"
  fi
}

check_ports() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      warn "port $port already in use"
    else
      pass "port $port available"
    fi
  else
    warn "lsof missing; cannot check port $port"
  fi
}

info "Scanning workspace: $ROOT_DIR"

check_cmd "python3"
check_python_version
check_optional_cmd "curl"
check_optional_cmd "lsof"

if command -v docker >/dev/null 2>&1; then
  pass "docker present"
else
  fail "docker missing (required for wechat-spider compose mode)"
fi

if docker compose version >/dev/null 2>&1; then
  pass "docker compose plugin available"
elif command -v docker-compose >/dev/null 2>&1; then
  pass "docker-compose available"
else
  fail "docker compose/docker-compose missing"
fi

info "Checking project structure"
check_file_exists "$MEDIA_DIR/api/main.py" "MediaCrawler API entry"
check_file_exists "$WECHAT_DIR/wechat-spider/run.py" "wechat-spider entry"
check_file_exists "$INTEL_DIR/intel_hub/pipeline.py" "intel_hub pipeline entry"

info "Checking MediaCrawler security config"
check_file_exists "$ROOT_DIR/ops/env/mediacrawler.env" "Ops MediaCrawler env"
check_file_exists "$MEDIA_DIR/.env" "MediaCrawler .env"
media_env_file="$ROOT_DIR/ops/env/mediacrawler.env"
if [ ! -f "$media_env_file" ] && [ -f "$MEDIA_DIR/.env" ]; then
  media_env_file="$MEDIA_DIR/.env"
fi

if [ -f "$media_env_file" ]; then
  auth_enabled="$(read_env_value "$media_env_file" "MEDIACRAWLER_API_AUTH_ENABLED")"
  api_key="$(read_env_value "$media_env_file" "MEDIACRAWLER_API_KEY")"
  trusted_hosts="$(read_env_value "$media_env_file" "MEDIACRAWLER_TRUSTED_HOSTS")"

  if [ "$(lower "$auth_enabled")" = "false" ]; then
    warn "MEDIACRAWLER_API_AUTH_ENABLED=false (not recommended for production)"
  else
    pass "MEDIACRAWLER_API_AUTH_ENABLED is enabled"
  fi

  if [ -z "$api_key" ]; then
    fail "MEDIACRAWLER_API_KEY is empty"
  elif echo "$api_key" | grep -qi "CHANGE_ME"; then
    fail "MEDIACRAWLER_API_KEY still uses placeholder value"
  else
    pass "MEDIACRAWLER_API_KEY is set"
  fi

  if [ "$trusted_hosts" = "*" ]; then
    warn "MEDIACRAWLER_TRUSTED_HOSTS=* expands attack surface"
  elif [ -z "$trusted_hosts" ]; then
    warn "MEDIACRAWLER_TRUSTED_HOSTS empty; default will be used"
  else
    pass "MEDIACRAWLER_TRUSTED_HOSTS set"
  fi
else
  fail "MediaCrawler env missing; configure ops/env/mediacrawler.env or MediaCrawler/.env"
fi

info "Checking wechat-spider config"
check_file_exists "$WECHAT_DIR/wechat-spider/config.yaml" "wechat-spider config"
check_file_exists "$ROOT_DIR/ops/env/wechat.env" "Ops wechat env"
if [ -f "$WECHAT_DIR/wechat-spider/config.yaml" ]; then
  service_host="$(awk -F: '/^[[:space:]]*service_host:/ {v=$2; sub(/#.*/, "", v); gsub(/"/, "", v); gsub(/[[:space:]]/, "", v); print v; exit}' "$WECHAT_DIR/wechat-spider/config.yaml" || true)"
  if [ "$service_host" = "0.0.0.0" ]; then
    warn "wechat service_host is 0.0.0.0; prefer 127.0.0.1 or private IP"
  else
    pass "wechat service_host is restricted: ${service_host:-unknown}"
  fi
fi

if rg -q "127\.0\.0\.1:8080:8080" "$WECHAT_DIR/docker-compose.yml" && rg -q "127\.0\.0\.1:3306:3306" "$WECHAT_DIR/docker-compose.yml"; then
  pass "wechat docker-compose ports bound to loopback"
else
  warn "wechat docker-compose ports are not loopback-only"
fi

if [ -f "$ROOT_DIR/ops/env/wechat.env" ]; then
  wechat_mysql_pwd="$(read_env_value "$ROOT_DIR/ops/env/wechat.env" "WECHAT_MYSQL_PASSWD")"
  if [ -z "$wechat_mysql_pwd" ]; then
    warn "WECHAT_MYSQL_PASSWD is empty"
  elif echo "$wechat_mysql_pwd" | grep -qi "CHANGE_ME"; then
    fail "WECHAT_MYSQL_PASSWD still uses placeholder value"
  else
    pass "WECHAT_MYSQL_PASSWD is set"
  fi
fi

info "Checking intel_hub runtime config"
check_file_exists "$INTEL_DIR/intel_hub/config.py" "intel_hub config"
check_file_exists "$ROOT_DIR/ops/env/intel_hub.env" "Ops intel_hub env"
check_file_exists "$INTEL_DIR/state/intel.db" "intel_hub sqlite db"

if [ -f "$ROOT_DIR/ops/env/intel_hub.env" ]; then
  intel_wechat_enable_db="$(read_env_value "$ROOT_DIR/ops/env/intel_hub.env" "INTEL_WECHAT_ENABLE_DB")"
  if [ "$(lower "$intel_wechat_enable_db")" = "false" ]; then
    warn "INTEL_WECHAT_ENABLE_DB=false; wechat data will not be ingested"
  else
    pass "INTEL_WECHAT_ENABLE_DB enabled"
  fi
fi

info "Checking local Python runtime"
check_python_modules "$MEDIA_DIR/.venv/bin/python" "MediaCrawler venv" fastapi uvicorn redis aiomysql
check_python_modules "$INTEL_DIR/.venv/bin/python" "intel_hub venv" fastapi uvicorn yaml pymysql

info "Checking planned service ports"
check_ports 8080
check_ports 18080
check_ports 3306
check_ports 6379

color "36" "\n========== Scan Summary =========="
color "32" "PASS: $pass_count"
color "33" "WARN: $warn_count"
color "31" "FAIL: $fail_count"

if [ "$fail_count" -gt 0 ]; then
  exit 2
fi
