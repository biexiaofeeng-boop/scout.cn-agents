#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/scout-deploy"

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker not found. Please install Docker Desktop first."
  exit 2
fi

if ! docker info >/dev/null 2>&1; then
  echo "[ERROR] Docker daemon is not running. Open Docker Desktop and retry."
  exit 2
fi

"$DEPLOY_DIR/docker-check.sh"

cd "$DEPLOY_DIR"
docker compose --env-file ./env/scout-wchat.env -f docker-compose.yml up -d --build

echo "[DONE] docker stack started"
echo "[NEXT] ./docker-status.sh"
