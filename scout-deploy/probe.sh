#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/scout-deploy"
MEDIA_DIR="$ROOT_DIR/scout-media-agents"
WCHAT_DIR="$ROOT_DIR/scout-wchat-agents"

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

if [ ! -d "$MEDIA_DIR/node_modules" ] || [ ! -d "$WCHAT_DIR/node_modules" ]; then
  echo "[ERROR] missing node_modules for adapters"
  echo "[HINT] run: $DEPLOY_DIR/bootstrap.sh"
  exit 2
fi

echo "[INFO] media agent health probe"
load_env "$DEPLOY_DIR/env/scout-media.env"
(cd "$MEDIA_DIR" && npx tsx src/health.ts) || true

echo "[INFO] wchat agent probe"
load_env "$DEPLOY_DIR/env/scout-wchat.env"
(cd "$WCHAT_DIR" && npx tsx src/probe.ts) || true
