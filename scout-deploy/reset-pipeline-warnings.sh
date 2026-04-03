#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/scout-deploy"
ENV_FILE="$DEPLOY_DIR/env/scout-hub.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "[ERROR] env file missing: $ENV_FILE"
  exit 2
fi

set -a
source "$ENV_FILE"
set +a

STATE_DIR="${SCOUT_STATE_DIR:-$ROOT_DIR/scout-hub/state}"
COUNTERS_FILE="$STATE_DIR/counters.json"
META_FILE="$STATE_DIR/meta.json"
DLQ_FILE="$STATE_DIR/dlq.jsonl"

if [ ! -f "$COUNTERS_FILE" ] || [ ! -f "$META_FILE" ]; then
  echo "[ERROR] state files missing under $STATE_DIR"
  exit 2
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$STATE_DIR/archive/$STAMP"
mkdir -p "$BACKUP_DIR"
cp "$COUNTERS_FILE" "$BACKUP_DIR/counters.json.bak"
cp "$META_FILE" "$BACKUP_DIR/meta.json.bak"
[ -f "$DLQ_FILE" ] && cp "$DLQ_FILE" "$BACKUP_DIR/dlq.jsonl.bak"

node - "$COUNTERS_FILE" "$META_FILE" <<'NODE'
const fs = require("node:fs");
const countersFile = process.argv[2];
const metaFile = process.argv[3];

const counters = JSON.parse(fs.readFileSync(countersFile, "utf8"));
counters.runsFailed = 0;
counters.recordsFailed = 0;
fs.writeFileSync(countersFile, JSON.stringify(counters, null, 2) + "\n");

const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
meta.dlqCount = 0;
fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + "\n");
NODE

: > "$DLQ_FILE"

echo "[DONE] reset warning baseline"
echo "[BACKUP] $BACKUP_DIR"
echo "--- current counters ---"
cat "$COUNTERS_FILE"
echo "--- current meta ---"
cat "$META_FILE"
