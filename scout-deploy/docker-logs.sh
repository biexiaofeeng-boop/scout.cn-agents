#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/scout-deploy"
SERVICE="${1:-}"

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker not found"
  exit 2
fi

cd "$DEPLOY_DIR"
if [ -n "$SERVICE" ]; then
  docker compose --env-file ./env/scout-wchat.env -f docker-compose.yml logs -f --tail=200 "$SERVICE"
else
  docker compose --env-file ./env/scout-wchat.env -f docker-compose.yml logs -f --tail=120
fi
