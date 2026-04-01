#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OPS_ENV_DIR="$ROOT_DIR/ops/env"
MEDIA_DIR="$ROOT_DIR/MediaCrawler"
INTEL_DIR="$ROOT_DIR/intel_hub"
RUNTIME_DIR="$ROOT_DIR/runtime"

FULL_MEDIACRAWLER=0
if [ "${1:-}" = "--full-mediacrawler" ]; then
  FULL_MEDIACRAWLER=1
fi

mkdir -p "$OPS_ENV_DIR" "$RUNTIME_DIR/logs" "$RUNTIME_DIR/pids"

copy_if_missing() {
  local src="$1"
  local dst="$2"
  if [ ! -f "$dst" ]; then
    cp "$src" "$dst"
    echo "[INFO] created $dst from template"
  fi
}

copy_if_missing "$OPS_ENV_DIR/mediacrawler.env.example" "$OPS_ENV_DIR/mediacrawler.env"
copy_if_missing "$OPS_ENV_DIR/wechat.env.example" "$OPS_ENV_DIR/wechat.env"
copy_if_missing "$OPS_ENV_DIR/intel_hub.env.example" "$OPS_ENV_DIR/intel_hub.env"

if [ ! -d "$MEDIA_DIR/.venv" ]; then
  python3 -m venv "$MEDIA_DIR/.venv"
fi
"$MEDIA_DIR/.venv/bin/python" -m pip install -U pip setuptools wheel

if [ "$FULL_MEDIACRAWLER" -eq 1 ]; then
  echo "[INFO] installing full MediaCrawler dependencies"
  "$MEDIA_DIR/.venv/bin/pip" install -r "$MEDIA_DIR/requirements.txt"
else
  echo "[INFO] installing minimal MediaCrawler API dependencies"
  "$MEDIA_DIR/.venv/bin/pip" install \
    'fastapi>=0.111.0' \
    'uvicorn>=0.30.0' \
    'python-dotenv>=1.0.1' \
    'redis>=4.6.0' \
    'aiomysql>=0.2.0' \
    'aiosqlite>=0.21.0' \
    'sqlalchemy>=2.0.43'
fi

if [ ! -d "$INTEL_DIR/.venv" ]; then
  python3 -m venv "$INTEL_DIR/.venv"
fi
"$INTEL_DIR/.venv/bin/python" -m pip install -U pip setuptools wheel
"$INTEL_DIR/.venv/bin/pip" install -e "$INTEL_DIR"

echo "[DONE] bootstrap finished"
echo "[NEXT] edit env files under $OPS_ENV_DIR, then run: $ROOT_DIR/ops/scan.sh"
