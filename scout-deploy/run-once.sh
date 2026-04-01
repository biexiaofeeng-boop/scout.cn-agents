#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/scout-deploy"
HUB_DIR="$ROOT_DIR/scout-hub"

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

load_env "$DEPLOY_DIR/env/scout-hub.env"

if [ ! -d "$HUB_DIR/node_modules" ]; then
  echo "[ERROR] missing dependencies: $HUB_DIR/node_modules"
  echo "[HINT] run: $DEPLOY_DIR/bootstrap.sh"
  exit 2
fi

cd "$HUB_DIR"
npx tsx src/cli.ts pipeline --once
