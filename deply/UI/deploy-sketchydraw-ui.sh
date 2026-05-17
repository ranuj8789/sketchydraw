#!/usr/bin/env bash
set -euo pipefail

# =========================
# SKETCHYDRAW UI DEPLOY ONLY
# Run from MacBook
# No Nginx config update
# No SSL changes
# No firewall changes
# =========================

SERVER_USER="mediautils"
SERVER_HOST="192.168.1.10"
SERVER_SSH_PORT="2222"

PROJECT_ROOT="/Users/ranujmahajan/projects/sketchydraw"
UI_DIR="$PROJECT_ROOT/ranuj_excalidraw"

REMOTE_UI_DIR="/var/www/sketchydraw-ui"
REMOTE_TMP_DIR="/tmp/sketchydraw-ui-deploy"

DOMAIN="sketchydraw.com"

echo "======================================"
echo " Deploying SketchyDraw UI only"
echo " Server: ${SERVER_USER}@${SERVER_HOST}:${SERVER_SSH_PORT}"
echo " UI Dir: ${UI_DIR}"
echo " Final UI Folder: ${REMOTE_UI_DIR}"
echo " Domain: https://${DOMAIN}"
echo "======================================"

if [ ! -d "$UI_DIR" ]; then
  echo "ERROR: UI directory not found: $UI_DIR"
  exit 1
fi

echo "Building SketchyDraw UI..."
cd "$UI_DIR"

npm install
DISABLE_ESLINT_PLUGIN=true REACT_APP_API_BASE_URL=/api npm run build

BUILD_DIR=""

if [ -d "$UI_DIR/dist" ]; then
  BUILD_DIR="$UI_DIR/dist"
elif [ -d "$UI_DIR/build" ]; then
  BUILD_DIR="$UI_DIR/build"
else
  echo "ERROR: No build output found. Expected dist/ or build/"
  exit 1
fi

echo "Build folder found: $BUILD_DIR"

echo "Checking SSH..."
ssh -p "$SERVER_SSH_PORT" "$SERVER_USER@$SERVER_HOST" "echo SSH OK"

echo "Preparing remote temp folder..."
ssh -p "$SERVER_SSH_PORT" "$SERVER_USER@$SERVER_HOST" "
  rm -rf '$REMOTE_TMP_DIR'
  mkdir -p '$REMOTE_TMP_DIR'
"

echo "Uploading UI files..."
scp -P "$SERVER_SSH_PORT" -r "$BUILD_DIR"/* "$SERVER_USER@$SERVER_HOST:$REMOTE_TMP_DIR/"

echo "Switching UI release..."

ssh -p "$SERVER_SSH_PORT" "$SERVER_USER@$SERVER_HOST" bash <<EOF
set -euo pipefail

REMOTE_UI_DIR="$REMOTE_UI_DIR"
REMOTE_TMP_DIR="$REMOTE_TMP_DIR"

echo "Checking UI folder..."
if [ ! -d "\$REMOTE_UI_DIR" ]; then
  echo "ERROR: \$REMOTE_UI_DIR does not exist."
  echo "Run one-time setup on server:"
  echo "sudo mkdir -p \$REMOTE_UI_DIR"
  echo "sudo chown -R mediautils:mediautils-app \$REMOTE_UI_DIR"
  echo "sudo chmod -R 775 \$REMOTE_UI_DIR"
  exit 1
fi

if [ ! -w "\$REMOTE_UI_DIR" ]; then
  echo "ERROR: mediautils cannot write to \$REMOTE_UI_DIR"
  echo "Fix on server:"
  echo "sudo chown -R mediautils:mediautils-app \$REMOTE_UI_DIR"
  echo "sudo chmod -R 775 \$REMOTE_UI_DIR"
  exit 1
fi

echo "Cleaning old UI files..."
rm -rf "\$REMOTE_UI_DIR"/*

echo "Copying new UI files..."
cp -r "\$REMOTE_TMP_DIR"/* "\$REMOTE_UI_DIR"/

echo "Setting UI permissions..."
chmod -R 755 "\$REMOTE_UI_DIR"

echo "Cleaning temp..."
rm -rf "\$REMOTE_TMP_DIR"

echo "Deployed UI files:"
ls -lah "\$REMOTE_UI_DIR" | head -30

echo ""
echo "UI deploy completed."
EOF

echo "Testing HTTPS domain..."
curl -I "https://$DOMAIN" || true

echo "Testing blocked scanner paths over HTTPS..."
curl -I "https://$DOMAIN/.env" || true
curl -I "https://$DOMAIN/etc/passwd" || true
curl -I "https://$DOMAIN/server-status" || true

echo "======================================"
echo " SketchyDraw UI deployed successfully"
echo " Open:"
echo " https://$DOMAIN"
echo "======================================"