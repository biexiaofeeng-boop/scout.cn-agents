#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/scout-deploy"

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker not found"
  exit 2
fi

cd "$DEPLOY_DIR"
docker compose --env-file ./env/scout-wchat.env -f docker-compose.yml down

echo "[DONE] docker stack stopped"
