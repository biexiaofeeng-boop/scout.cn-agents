#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/runtime"
WECHAT_DIR="$ROOT_DIR/wechat-spider"

stop_pid() {
  local name="$1"
  local pid_file="$RUNTIME_DIR/pids/$name.pid"
  if [ ! -f "$pid_file" ]; then
    echo "[INFO] $name pid file not found"
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
    echo "[OK] stopped $name (pid=$pid)"
  else
    echo "[INFO] $name already stopped (pid=$pid)"
  fi
  rm -f "$pid_file"
}

stop_pid "intel_monitor"
stop_pid "intel_scheduler"
stop_pid "mediacrawler_api"

if command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "$WECHAT_DIR/docker-compose.yml" down || true
    echo "[OK] wechat-spider stack stopped by docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f "$WECHAT_DIR/docker-compose.yml" down || true
    echo "[OK] wechat-spider stack stopped by docker-compose"
  else
    echo "[WARN] docker compose missing, skip wechat-spider shutdown"
  fi
fi

echo "[DONE] stop sequence finished"
