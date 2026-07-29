#!/usr/bin/env bash
set -Eeuo pipefail

# =========================
# SKETCHYDRAW UI DEPLOY ONLY
# Run from MacBook
#
# Does not:
# - update Nginx
# - update SSL
# - change firewall
# - restart backend
# =========================

SERVER_USER="ranuj"
SERVER_HOST="192.168.1.10"
SERVER_SSH_PORT="2222"

PROJECT_ROOT="/Users/ranujmahajan/projects/sketchydraw"
UI_DIR="$PROJECT_ROOT/ranuj_excalidraw"

REMOTE_UI_DIR="/var/www/sketchydraw-ui"
REMOTE_TMP_DIR="/tmp/sketchydraw-ui-deploy"

DOMAIN="sketchydraw.com"

SSH_COMMAND="ssh -p $SERVER_SSH_PORT"
RSYNC_SSH="ssh -p $SERVER_SSH_PORT"

echo "======================================"
echo " Deploying SketchyDraw UI only"
echo " Server: ${SERVER_USER}@${SERVER_HOST}:${SERVER_SSH_PORT}"
echo " UI Dir: ${UI_DIR}"
echo " Final UI Folder: ${REMOTE_UI_DIR}"
echo " Domain: https://${DOMAIN}"
echo "======================================"

# -------------------------
# Local project validation
# -------------------------

if [ ! -d "$UI_DIR" ]; then
  echo "ERROR: UI directory not found:"
  echo "$UI_DIR"
  exit 1
fi

if [ ! -f "$UI_DIR/package.json" ]; then
  echo "ERROR: package.json not found:"
  echo "$UI_DIR/package.json"
  exit 1
fi

cd "$UI_DIR"

echo ""
echo "Cleaning old build output..."
rm -rf "$UI_DIR/build" "$UI_DIR/dist"

echo ""
echo "Installing dependencies..."

if [ -f "$UI_DIR/package-lock.json" ]; then
  npm ci
else
  npm install
fi

echo ""
echo "Building SketchyDraw UI..."

DISABLE_ESLINT_PLUGIN=true \
REACT_APP_API_BASE_URL= \
REACT_APP_API_BASE= \
REACT_APP_API_URL= \
npm run build

# -------------------------
# Find build output
# -------------------------

BUILD_DIR=""

if [ -f "$UI_DIR/dist/index.html" ]; then
  BUILD_DIR="$UI_DIR/dist"
elif [ -f "$UI_DIR/build/index.html" ]; then
  BUILD_DIR="$UI_DIR/build"
else
  echo "ERROR: Build output not found."
  echo "Expected:"
  echo "  $UI_DIR/dist/index.html"
  echo "or:"
  echo "  $UI_DIR/build/index.html"
  exit 1
fi

echo ""
echo "Build folder found:"
echo "$BUILD_DIR"

# -------------------------
# SSH validation
# -------------------------

echo ""
echo "Checking SSH connection..."

$SSH_COMMAND "$SERVER_USER@$SERVER_HOST" \
  "echo 'SSH connection successful'"

# -------------------------
# Remote folder validation
# -------------------------

echo ""
echo "Checking remote UI folder..."

$SSH_COMMAND "$SERVER_USER@$SERVER_HOST" bash <<EOF
set -Eeuo pipefail

REMOTE_UI_DIR="$REMOTE_UI_DIR"
REMOTE_TMP_DIR="$REMOTE_TMP_DIR"

if [ ! -d "\$REMOTE_UI_DIR" ]; then
  echo "ERROR: UI folder does not exist:"
  echo "\$REMOTE_UI_DIR"
  echo ""
  echo "Run once on server:"
  echo "sudo mkdir -p \$REMOTE_UI_DIR"
  echo "sudo chown -R ranuj:sketchydraw \$REMOTE_UI_DIR"
  echo "sudo chmod 755 \$REMOTE_UI_DIR"
  exit 1
fi

if [ ! -w "\$REMOTE_UI_DIR" ]; then
  echo "ERROR: ranuj cannot write to:"
  echo "\$REMOTE_UI_DIR"
  echo ""
  echo "Fix on server:"
  echo "sudo chown -R ranuj:sketchydraw \$REMOTE_UI_DIR"
  echo "sudo chmod 755 \$REMOTE_UI_DIR"
  exit 1
fi

rm -rf "\$REMOTE_TMP_DIR"
mkdir -p "\$REMOTE_TMP_DIR"
EOF

# -------------------------
# Upload build
# -------------------------

echo ""
echo "Uploading UI build..."

rsync -az \
  --delete \
  -e "$RSYNC_SSH" \
  "$BUILD_DIR/" \
  "$SERVER_USER@$SERVER_HOST:$REMOTE_TMP_DIR/"

# -------------------------
# Switch release
# -------------------------

echo ""
echo "Switching UI release..."

$SSH_COMMAND "$SERVER_USER@$SERVER_HOST" bash <<EOF
set -Eeuo pipefail

REMOTE_UI_DIR="$REMOTE_UI_DIR"
REMOTE_TMP_DIR="$REMOTE_TMP_DIR"

if [ ! -f "\$REMOTE_TMP_DIR/index.html" ]; then
  echo "ERROR: Uploaded index.html not found:"
  echo "\$REMOTE_TMP_DIR/index.html"
  exit 1
fi

echo "Removing old UI files..."
find "\$REMOTE_UI_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +

echo "Copying new UI files..."
cp -a "\$REMOTE_TMP_DIR/." "\$REMOTE_UI_DIR/"

echo "Setting UI permissions..."
find "\$REMOTE_UI_DIR" -type d -exec chmod 755 {} \;
find "\$REMOTE_UI_DIR" -type f -exec chmod 644 {} \;

echo "Cleaning temporary upload..."
rm -rf "\$REMOTE_TMP_DIR"

echo ""
echo "Deployed UI files:"
ls -lah "\$REMOTE_UI_DIR" | head -30
EOF

# -------------------------
# Public domain test
# -------------------------

echo ""
echo "Testing HTTPS domain..."

HTTP_CODE="$(
  curl \
    --silent \
    --show-error \
    --location \
    --output /dev/null \
    --write-out "%{http_code}" \
    "https://$DOMAIN"
)"

if [ "$HTTP_CODE" != "200" ]; then
  echo "ERROR: https://$DOMAIN returned HTTP $HTTP_CODE"
  exit 1
fi

echo "HTTPS test successful: HTTP $HTTP_CODE"

echo ""
echo "Testing blocked scanner paths..."

for BLOCKED_PATH in \
  "/.env" \
  "/etc/passwd" \
  "/server-status"
do
  BLOCKED_CODE="$(
    curl \
      --silent \
      --location \
      --output /dev/null \
      --write-out "%{http_code}" \
      "https://$DOMAIN$BLOCKED_PATH"
  )"

  echo "$BLOCKED_PATH -> HTTP $BLOCKED_CODE"
done

echo ""
echo "======================================"
echo " SketchyDraw UI deployed successfully"
echo " Open:"
echo " https://$DOMAIN"
echo "======================================"