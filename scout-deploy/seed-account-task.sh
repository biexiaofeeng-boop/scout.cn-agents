#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/scout-deploy"
ENV_FILE="$DEPLOY_DIR/env/scout-wchat.env"

if [ "$#" -lt 1 ]; then
  echo "usage: ./seed-account-task.sh <__biz1> [__biz2] [...]"
  echo "example: ./seed-account-task.sh MzIxNzg1ODQ0MQ=="
  exit 2
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker not found"
  exit 2
fi
if ! docker info >/dev/null 2>&1; then
  echo "[ERROR] docker daemon not running"
  exit 2
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "[ERROR] env file missing: $ENV_FILE"
  exit 2
fi

set -a
source "$ENV_FILE"
set +a

DB_NAME="${WECHAT_MYSQL_DB:-test}"
DB_USER="${WECHAT_MYSQL_USER:-root}"
DB_PASS="${WECHAT_MYSQL_PASSWD:-}"

if [ -z "$DB_PASS" ]; then
  echo "[ERROR] WECHAT_MYSQL_PASSWD is empty in $ENV_FILE"
  exit 2
fi

SQL_FILE="$(mktemp)"
trap 'rm -f "$SQL_FILE"' EXIT

{
  echo "START TRANSACTION;"
  for raw in "$@"; do
    IFS=',' read -r -a items <<< "$raw"
    for biz in "${items[@]}"; do
      biz="$(echo "$biz" | xargs)"
      [ -z "$biz" ] && continue
      cat <<SQL
INSERT INTO wechat_account_task (__biz, last_publish_time, last_spider_time, is_zombie)
SELECT '$biz', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM wechat_account_task WHERE __biz = '$biz'
);
SQL
    done
  done
  echo "COMMIT;"
} > "$SQL_FILE"

cd "$DEPLOY_DIR"
docker compose --env-file ./env/scout-wchat.env exec -T mariadb \
  mariadb -u"$DB_USER" -p"$DB_PASS" -D "$DB_NAME" < "$SQL_FILE"

echo "--- seeded account tasks ---"
docker compose --env-file ./env/scout-wchat.env exec -T mariadb \
  mariadb -u"$DB_USER" -p"$DB_PASS" -D "$DB_NAME" \
  -e "SELECT COUNT(*) AS account_task_cnt FROM wechat_account_task; SELECT id, __biz, last_spider_time, is_zombie FROM wechat_account_task ORDER BY id DESC LIMIT 10;"
