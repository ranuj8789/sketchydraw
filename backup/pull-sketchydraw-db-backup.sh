#!/usr/bin/env bash
set -euo pipefail

# =========================
# PULL SKETCHYDRAW DB BACKUP
# Run from MacBook
# Creates fresh backup on server and downloads it locally
# =========================

SERVER_USER="mediautils"
SERVER_HOST="192.168.1.10"
SERVER_SSH_PORT="2222"

DB_NAME="sketchydraw"

MAC_BACKUP_DIR="$HOME/Backups/sketchydraw/db"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_NAME="${DB_NAME}_${TIMESTAMP}.dump"
REMOTE_TMP_DIR="/tmp/sketchydraw-db-backup-pull"
REMOTE_BACKUP_FILE="$REMOTE_TMP_DIR/$BACKUP_NAME"

echo "======================================"
echo " Pulling SketchyDraw DB Backup"
echo " Server: ${SERVER_USER}@${SERVER_HOST}:${SERVER_SSH_PORT}"
echo " DB: $DB_NAME"
echo " Local folder: $MAC_BACKUP_DIR"
echo "======================================"

mkdir -p "$MAC_BACKUP_DIR"

echo "Checking SSH..."
ssh -p "$SERVER_SSH_PORT" "$SERVER_USER@$SERVER_HOST" "echo SSH OK"

echo "Creating DB backup on server..."
ssh -p "$SERVER_SSH_PORT" "$SERVER_USER@$SERVER_HOST" bash <<EOF
set -euo pipefail

REMOTE_TMP_DIR="$REMOTE_TMP_DIR"
REMOTE_BACKUP_FILE="$REMOTE_BACKUP_FILE"

mkdir -p "\$REMOTE_TMP_DIR"
rm -f "\$REMOTE_TMP_DIR"/*.dump "\$REMOTE_TMP_DIR"/*.tmp

echo "Running pg_dump through safe helper..."
sudo -n /usr/local/sbin/sketchydraw-create-db-backup "\$REMOTE_BACKUP_FILE"

echo "Backup created on server:"
ls -lh "\$REMOTE_BACKUP_FILE"
EOF

echo "Downloading backup to Mac..."
scp -P "$SERVER_SSH_PORT" \
  "$SERVER_USER@$SERVER_HOST:$REMOTE_BACKUP_FILE" \
  "$MAC_BACKUP_DIR/$BACKUP_NAME"

echo "Verifying local backup..."
ls -lh "$MAC_BACKUP_DIR/$BACKUP_NAME"

echo "Cleaning temporary backup from server..."
ssh -p "$SERVER_SSH_PORT" "$SERVER_USER@$SERVER_HOST" "rm -f '$REMOTE_BACKUP_FILE'"

echo "======================================"
echo " SketchyDraw Backup Pulled Successfully"
echo " Local file:"
echo " $MAC_BACKUP_DIR/$BACKUP_NAME"
echo "======================================"