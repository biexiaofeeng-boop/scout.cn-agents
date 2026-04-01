#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/runtime/scout-deploy"

stop_proc() {
  local name="$1"
  local pid_file="$RUNTIME_DIR/pids/$name.pid"

  if [ ! -f "$pid_file" ]; then
    echo "[INFO] $name pid file missing"
    return
  fi

  local pid
  pid="$(cat "$pid_file")"
  if kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid" || true
    sleep 1
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill -9 "$pid" || true
    fi
    echo "[OK] stopped $name pid=$pid"
  else
    echo "[INFO] $name already stopped pid=$pid"
  fi

  rm -f "$pid_file"
}

stop_proc "scout_hub_scheduler"
stop_proc "scout_hub_api"

echo "[DONE] stop complete"
