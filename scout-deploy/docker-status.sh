#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/scout-deploy"

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker not found"
  exit 2
fi

cd "$DEPLOY_DIR"
docker compose --env-file ./env/scout-wchat.env -f docker-compose.yml ps || true

echo "--- health probes ---"
for url in \
  "http://127.0.0.1:18080/health" \
  "http://127.0.0.1:18080/alerts" \
  "http://127.0.0.1:8080"; do
  if curl -fsS --max-time 3 "$url" >/tmp/scout_docker_probe.txt 2>/dev/null; then
    echo "[OK] $url"
    head -c 220 /tmp/scout_docker_probe.txt; echo
  else
    echo "[BAD] $url"
  fi
done
