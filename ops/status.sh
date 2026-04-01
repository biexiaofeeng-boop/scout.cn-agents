#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/runtime"
INTEL_DB="$ROOT_DIR/intel_hub/state/intel.db"

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

probe_url() {
  local url="$1"
  if command -v curl >/dev/null 2>&1; then
    if curl -fsS --max-time 3 "$url" >/tmp/codex_status_url.txt 2>/dev/null; then
      echo "[OK] $url"
    else
      echo "[BAD] $url"
    fi
  else
    echo "[SKIP] curl missing for $url"
  fi
}

show_proc "mediacrawler_api"
show_proc "intel_scheduler"
show_proc "intel_monitor"

probe_url "http://127.0.0.1:8080/api/health"
probe_url "http://127.0.0.1:18080/health"
probe_url "http://127.0.0.1:18080/alerts"

if [ -f "$INTEL_DB" ]; then
  python3 - <<PY
import sqlite3
from pathlib import Path
p = Path("$INTEL_DB")
conn = sqlite3.connect(str(p))
cur = conn.cursor()
for q, label in [
    ("select count(*) from intel_events", "intel_events"),
    ("select count(*) from intel_pipeline_runs", "intel_pipeline_runs"),
    ("select count(*) from intel_pipeline_runs where failed_count > 0", "failed_runs"),
]:
    cur.execute(q)
    print(f"[DB] {label}={cur.fetchone()[0]}")
conn.close()
PY
else
  echo "[INFO] intel_hub db not found: $INTEL_DB"
fi

if command -v docker >/dev/null 2>&1; then
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' || true
fi
