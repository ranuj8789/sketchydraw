#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="sketchydraw-ui"

PROJECT_ROOT="/mnt/media-nvme/sketchydraw"
UI_DIR="$PROJECT_ROOT/ranuj_excalidraw"
BUILD_DIR="$UI_DIR/build"

LIVE_DIR="/var/www/sketchydraw-ui"
DOMAIN="https://sketchydraw.com"

echo "======================================"
echo " Deploying $APP_NAME"
echo "======================================"

echo "1) Go to UI folder"
cd "$UI_DIR"

echo "2) Install dependencies"
npm install

echo "3) Build UI"
npm run build

echo "4) Verify build"
if [ ! -f "$BUILD_DIR/index.html" ]; then
  echo "❌ Build failed: index.html not found"
  exit 1
fi

echo "5) Verify live folder"
if [ ! -d "$LIVE_DIR" ]; then
  echo "❌ Live folder missing: $LIVE_DIR"
  exit 1
fi

echo "6) Copy build to live folder"
sudo rsync -a --delete "$BUILD_DIR/" "$LIVE_DIR/"

echo "7) Set permissions"
sudo chown -R mediautils:mediautils-app "$LIVE_DIR"
sudo find "$LIVE_DIR" -type d -exec chmod 755 {} \;
sudo find "$LIVE_DIR" -type f -exec chmod 644 {} \;

echo "8) Test nginx config"
sudo nginx -t

echo "9) Reload nginx"
sudo systemctl reload nginx

echo "10) Curl test"
HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN")"

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Curl failed. HTTP code: $HTTP_CODE"
  exit 1
fi

echo "✅ Deploy successful"
echo "✅ $DOMAIN returned $HTTP_CODE"