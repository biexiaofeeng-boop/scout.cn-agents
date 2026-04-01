#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/scout-deploy"
RUNTIME_DIR="$ROOT_DIR/runtime/scout-deploy"
FORCE=0

if [ "${1:-}" = "--force" ]; then
  FORCE=1
fi

copy_if_missing() {
  local src="$1"
  local dst="$2"
  if [ ! -f "$dst" ]; then
    cp "$src" "$dst"
    echo "[INFO] created $dst"
  fi
}

copy_if_missing "$DEPLOY_DIR/env/scout-hub.env.example" "$DEPLOY_DIR/env/scout-hub.env"
copy_if_missing "$DEPLOY_DIR/env/scout-media.env.example" "$DEPLOY_DIR/env/scout-media.env"
copy_if_missing "$DEPLOY_DIR/env/scout-wchat.env.example" "$DEPLOY_DIR/env/scout-wchat.env"

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] node not found"
  exit 2
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] npm not found"
  exit 2
fi

mkdir -p "$RUNTIME_DIR/logs" "$RUNTIME_DIR/pids"

install_project() {
  local dir="$1"
  local label="$2"

  if [ ! -f "$dir/package.json" ]; then
    echo "[ERROR] missing package.json for $label: $dir"
    exit 2
  fi

  if [ "$FORCE" -eq 1 ] || [ ! -d "$dir/node_modules" ]; then
    echo "[INFO] installing dependencies: $label"
    (cd "$dir" && npm install --no-audit --no-fund)
  else
    echo "[INFO] dependencies already present: $label"
  fi
}

install_project "$ROOT_DIR/scout-hub" "scout-hub"
install_project "$ROOT_DIR/scout-media-agents" "scout-media-agents"
install_project "$ROOT_DIR/scout-wchat-agents" "scout-wchat-agents"

echo "[DONE] bootstrap complete"
echo "[NEXT] run: $DEPLOY_DIR/check.sh"
