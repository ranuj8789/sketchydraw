#!/usr/bin/env bash
set -euo pipefail

# =========================
# RESTORE SKETCHYDRAW DB LOCALLY
# Run from MacBook
# Uses PostgreSQL 18 client tools
# =========================

PG_BIN="/opt/homebrew/opt/postgresql@18/bin"

LOCAL_DB_NAME="sketchydraw_local"
LOCAL_DB_USER="ranujmahajan"
LOCAL_DB_HOST="localhost"
LOCAL_DB_PORT="5432"

BACKUP_DIR="$HOME/Backups/sketchydraw/db"

echo "======================================"
echo " Restore SketchyDraw DB Locally"
echo " PostgreSQL Client: $PG_BIN"
echo "======================================"

if [ ! -x "$PG_BIN/psql" ]; then
  echo "ERROR: psql not found at $PG_BIN/psql"
  echo "Check PostgreSQL 18 install path:"
  echo "brew --prefix postgresql@18"
  exit 1
fi

if [ ! -x "$PG_BIN/pg_restore" ]; then
  echo "ERROR: pg_restore not found at $PG_BIN/pg_restore"
  exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
  echo "ERROR: Backup folder not found: $BACKUP_DIR"
  exit 1
fi

BACKUP_FILE="$(ls -t "$BACKUP_DIR"/sketchydraw_*.dump 2>/dev/null | head -1 || true)"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found in $BACKUP_DIR"
  exit 1
fi

echo " DB Name: $LOCAL_DB_NAME"
echo " DB User: $LOCAL_DB_USER"
echo " Host: $LOCAL_DB_HOST"
echo " Port: $LOCAL_DB_PORT"
echo " Backup: $BACKUP_FILE"
echo "======================================"

echo "Checking PostgreSQL 18 client versions..."
"$PG_BIN/psql" --version
"$PG_BIN/pg_restore" --version

echo "Checking local PostgreSQL connection..."
"$PG_BIN/psql" \
  -h "$LOCAL_DB_HOST" \
  -p "$LOCAL_DB_PORT" \
  -U "$LOCAL_DB_USER" \
  -d postgres \
  -c "SELECT version();"

echo "Terminating existing connections to $LOCAL_DB_NAME if any..."
"$PG_BIN/psql" \
  -h "$LOCAL_DB_HOST" \
  -p "$LOCAL_DB_PORT" \
  -U "$LOCAL_DB_USER" \
  -d postgres \
  -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$LOCAL_DB_NAME'
  AND pid <> pg_backend_pid();
"

echo "Dropping old local DB if exists..."
"$PG_BIN/dropdb" \
  -h "$LOCAL_DB_HOST" \
  -p "$LOCAL_DB_PORT" \
  -U "$LOCAL_DB_USER" \
  --if-exists \
  "$LOCAL_DB_NAME"

echo "Creating fresh local DB..."
"$PG_BIN/createdb" \
  -h "$LOCAL_DB_HOST" \
  -p "$LOCAL_DB_PORT" \
  -U "$LOCAL_DB_USER" \
  "$LOCAL_DB_NAME"

echo "Restoring backup..."
"$PG_BIN/pg_restore" \
  -h "$LOCAL_DB_HOST" \
  -p "$LOCAL_DB_PORT" \
  -U "$LOCAL_DB_USER" \
  --dbname="$LOCAL_DB_NAME" \
  --no-owner \
  --no-privileges \
  "$BACKUP_FILE"

echo "Verifying restore tables..."
"$PG_BIN/psql" \
  -h "$LOCAL_DB_HOST" \
  -p "$LOCAL_DB_PORT" \
  -U "$LOCAL_DB_USER" \
  -d "$LOCAL_DB_NAME" \
  -c "\dt"

echo "Checking important table counts..."
"$PG_BIN/psql" \
  -h "$LOCAL_DB_HOST" \
  -p "$LOCAL_DB_PORT" \
  -U "$LOCAL_DB_USER" \
  -d "$LOCAL_DB_NAME" \
  -c "
SELECT 'app_user' AS table_name, count(*) FROM app_user
UNION ALL
SELECT 'saved_drawing', count(*) FROM saved_drawing
UNION ALL
SELECT 'drawing_group', count(*) FROM drawing_group
UNION ALL
SELECT 'payment_transaction', count(*) FROM payment_transaction
UNION ALL
SELECT 'plan', count(*) FROM plan
UNION ALL
SELECT 'user_subscription', count(*) FROM user_subscription
UNION ALL
SELECT 'app_log', count(*) FROM app_log;
"

echo "======================================"
echo " Restore Completed Successfully"
echo " Local DB: $LOCAL_DB_NAME"
echo " Backup: $BACKUP_FILE"
echo "======================================"