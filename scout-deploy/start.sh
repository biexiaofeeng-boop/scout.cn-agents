#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/scout-deploy"
HUB_DIR="$ROOT_DIR/scout-hub"
RUNTIME_DIR="$ROOT_DIR/runtime/scout-deploy"

mkdir -p "$RUNTIME_DIR/logs" "$RUNTIME_DIR/pids"

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

start_process() {
  local name="$1"
  local pid_file="$RUNTIME_DIR/pids/$name.pid"
  shift

  if [ -f "$pid_file" ]; then
    local old_pid
    old_pid="$(cat "$pid_file")"
    if kill -0 "$old_pid" >/dev/null 2>&1; then
      echo "[INFO] $name already running pid=$old_pid"
      return
    fi
  fi

  if command -v setsid >/dev/null 2>&1; then
    setsid nohup "$@" >"$RUNTIME_DIR/logs/$name.log" 2>&1 < /dev/null &
  else
    nohup "$@" >"$RUNTIME_DIR/logs/$name.log" 2>&1 < /dev/null &
  fi
  local pid=$!
  echo "$pid" >"$pid_file"
  sleep 1
  if kill -0 "$pid" >/dev/null 2>&1; then
    echo "[OK] started $name pid=$pid"
  else
    echo "[ERROR] $name exited immediately (pid=$pid)"
    if [ -f "$RUNTIME_DIR/logs/$name.log" ]; then
      tail -n 40 "$RUNTIME_DIR/logs/$name.log" || true
    fi
    return 2
  fi
}

load_env "$DEPLOY_DIR/env/scout-hub.env"

if [ ! -d "$HUB_DIR/node_modules" ]; then
  echo "[ERROR] missing dependencies: $HUB_DIR/node_modules"
  echo "[HINT] run: $DEPLOY_DIR/bootstrap.sh"
  exit 2
fi

HOST="${SCOUT_MONITOR_HOST:-127.0.0.1}"
PORT="${SCOUT_MONITOR_PORT:-18080}"
INTERVAL="${SCOUT_SCHEDULER_INTERVAL_SEC:-300}"

if [ "${SCOUT_RUN_ON_START:-false}" = "true" ]; then
  echo "[INFO] running one immediate cycle"
  (cd "$HUB_DIR" && npx tsx src/cli.ts pipeline --once) || true
fi

start_process "scout_hub_api" bash -lc "cd '$HUB_DIR' && exec npx tsx src/cli.ts api --host '$HOST' --port '$PORT'"
start_process "scout_hub_scheduler" bash -lc "cd '$HUB_DIR' && exec npx tsx src/cli.ts scheduler --interval '$INTERVAL'"

echo "[DONE] started scout-hub services"
echo "[NEXT] run: $DEPLOY_DIR/status.sh"
