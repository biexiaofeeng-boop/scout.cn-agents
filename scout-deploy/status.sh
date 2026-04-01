#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/scout-deploy"
RUNTIME_DIR="$ROOT_DIR/runtime/scout-deploy"

load_env() {
  local f="$1"
  if [ -f "$f" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
      case "$line" in
        ""|\#*) continue ;;
      esac
      local key="${line%%=*}"
      local value="${line#*=}"
      if [ -z "${!key+x}" ]; then
        export "$key=$value"
      fi
    done < "$f"
  fi
}

show_proc() {
  local name="$1"
  local pid_file="$RUNTIME_DIR/pids/$name.pid"

  if [ ! -f "$pid_file" ]; then
    echo "[STOPPED] $name (pid file missing)"
    return
  fi

  local pid
  pid="$(cat "$pid_file")"
  if kill -0 "$pid" >/dev/null 2>&1; then
    echo "[RUNNING] $name pid=$pid"
  else
    echo "[DEAD] $name pid=$pid"
  fi
}

probe() {
  local url="$1"
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS --max-time 3 "$url" >/tmp/scout_deploy_probe.txt 2>/dev/null; then
      echo "[OK] $url"
      head -c 300 /tmp/scout_deploy_probe.txt; echo
    else
      echo "[BAD] $url"
    fi
  else
    echo "[SKIP] curl missing: $url"
  fi
}

load_env "$DEPLOY_DIR/env/scout-hub.env"
HOST="${SCOUT_MONITOR_HOST:-127.0.0.1}"
PORT="${SCOUT_MONITOR_PORT:-18080}"

show_proc "scout_hub_api"
show_proc "scout_hub_scheduler"

probe "http://$HOST:$PORT/health"
probe "http://$HOST:$PORT/alerts"
probe "http://$HOST:$PORT/runs"

if [ -f "$RUNTIME_DIR/logs/scout_hub_scheduler.log" ]; then
  echo "--- scheduler log tail ---"
  tail -n 20 "$RUNTIME_DIR/logs/scout_hub_scheduler.log" || true
fi
