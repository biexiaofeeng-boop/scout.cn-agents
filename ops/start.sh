#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OPS_ENV_DIR="$ROOT_DIR/ops/env"
MEDIA_DIR="$ROOT_DIR/MediaCrawler"
WECHAT_DIR="$ROOT_DIR/wechat-spider"
INTEL_DIR="$ROOT_DIR/intel_hub"
RUNTIME_DIR="$ROOT_DIR/runtime"

mkdir -p "$RUNTIME_DIR/logs" "$RUNTIME_DIR/pids"

load_env() {
  local file="$1"
  if [ -f "$file" ]; then
    set -a
    . "$file"
    set +a
  fi
}

start_process() {
  local name="$1"
  local pid_file="$RUNTIME_DIR/pids/$name.pid"
  shift
  if [ -f "$pid_file" ]; then
    local old_pid
    old_pid="$(cat "$pid_file")"
    if kill -0 "$old_pid" >/dev/null 2>&1; then
      echo "[INFO] $name already running (pid=$old_pid)"
      return
    fi
  fi

  nohup "$@" >"$RUNTIME_DIR/logs/$name.log" 2>&1 &
  local pid=$!
  echo "$pid" >"$pid_file"
  echo "[OK] started $name (pid=$pid)"
}

load_env "$OPS_ENV_DIR/mediacrawler.env"
load_env "$OPS_ENV_DIR/intel_hub.env"

if command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    docker compose --env-file "$OPS_ENV_DIR/wechat.env" -f "$WECHAT_DIR/docker-compose.yml" up -d mariadb redis wechat-spider
    echo "[OK] wechat-spider stack started by docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose --env-file "$OPS_ENV_DIR/wechat.env" -f "$WECHAT_DIR/docker-compose.yml" up -d mariadb redis wechat-spider
    echo "[OK] wechat-spider stack started by docker-compose"
  else
    echo "[WARN] docker compose not found, skipped wechat-spider stack"
  fi
else
  echo "[WARN] docker not found, skipped wechat-spider stack"
fi

MEDIA_PY="$MEDIA_DIR/.venv/bin/python"
INTEL_PY="$INTEL_DIR/.venv/bin/python"

if [ ! -x "$MEDIA_PY" ]; then
  echo "[ERROR] missing MediaCrawler venv: $MEDIA_PY"
  echo "[HINT] run: $ROOT_DIR/ops/bootstrap.sh"
  exit 2
fi

if [ ! -x "$INTEL_PY" ]; then
  echo "[ERROR] missing intel_hub venv: $INTEL_PY"
  echo "[HINT] run: $ROOT_DIR/ops/bootstrap.sh"
  exit 2
fi

start_process "mediacrawler_api" bash -lc "cd '$MEDIA_DIR' && exec '$MEDIA_PY' -m api.main"

INTEL_INTERVAL="${INTEL_SCHEDULER_INTERVAL:-300}"
INTEL_MONITOR_HOST="${INTEL_MONITOR_HOST:-127.0.0.1}"
INTEL_MONITOR_PORT="${INTEL_MONITOR_PORT:-18080}"

start_process "intel_scheduler" bash -lc "cd '$INTEL_DIR' && exec '$INTEL_PY' -m intel_hub.scheduler --interval '$INTEL_INTERVAL'"
start_process "intel_monitor" bash -lc "cd '$INTEL_DIR' && exec '$INTEL_PY' -m intel_hub.monitor_api --host '$INTEL_MONITOR_HOST' --port '$INTEL_MONITOR_PORT'"

echo "[DONE] startup sequence finished"
echo "[NEXT] run: $ROOT_DIR/ops/status.sh"
