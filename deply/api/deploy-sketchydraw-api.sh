#!/usr/bin/env bash
set -euo pipefail

# =========================
# SKETCHYDRAW API DEPLOY
# Run from MacBook
# Direct upload to releases
# SSH user: mediautils
# No /tmp
# No sudo cp/chown/chmod/ln
# =========================

SERVER_USER="mediautils"
SERVER_HOST="192.168.1.10"
SERVER_SSH_PORT="2222"

PROJECT_ROOT="/Users/ranujmahajan/projects/sketchydraw"
API_DIR="$PROJECT_ROOT/sketchdraw-api"

REMOTE_BASE="/mnt/media-nvme/sketchydraw/app"
REMOTE_RELEASES="$REMOTE_BASE/releases"
REMOTE_CURRENT="$REMOTE_BASE/current"

SERVICE_NAME="sketchydraw-api"
JAR_LINK_NAME="sketchydraw-api.jar"

LOCAL_PORT="8081"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
RELEASE_NAME="sketchydraw-api-${TIMESTAMP}.jar"

echo "======================================"
echo " Deploying SketchyDraw API"
echo " Server: ${SERVER_USER}@${SERVER_HOST}:${SERVER_SSH_PORT}"
echo " Remote base: ${REMOTE_BASE}"
echo " Release: ${RELEASE_NAME}"
echo "======================================"

echo "Building API..."
cd "$API_DIR"
mvn clean package -DskipTests

LOCAL_JAR="$(ls -t target/*.jar | grep -v 'original' | head -1 || true)"

if [ -z "$LOCAL_JAR" ] || [ ! -f "$LOCAL_JAR" ]; then
  echo "ERROR: No jar found in target/"
  exit 1
fi

echo "Jar found: $LOCAL_JAR"

echo "Checking SSH..."
ssh -p "$SERVER_SSH_PORT" "$SERVER_USER@$SERVER_HOST" "whoami && echo SSH OK"

echo "Checking remote write access..."
ssh -p "$SERVER_SSH_PORT" "$SERVER_USER@$SERVER_HOST" bash <<EOF
set -euo pipefail

REMOTE_RELEASES="$REMOTE_RELEASES"
REMOTE_CURRENT="$REMOTE_CURRENT"

if [ ! -w "\$REMOTE_RELEASES" ]; then
  echo "ERROR: mediautils cannot write releases: \$REMOTE_RELEASES"
  exit 1
fi

if [ ! -w "\$REMOTE_CURRENT" ]; then
  echo "ERROR: mediautils cannot write current: \$REMOTE_CURRENT"
  exit 1
fi

echo "Remote write access OK."
EOF

echo "Uploading jar directly to releases..."
scp -P "$SERVER_SSH_PORT" "$LOCAL_JAR" "$SERVER_USER@$SERVER_HOST:$REMOTE_RELEASES/$RELEASE_NAME"

echo "Switching release and restarting service..."

ssh -p "$SERVER_SSH_PORT" "$SERVER_USER@$SERVER_HOST" bash <<EOF
set -euo pipefail

REMOTE_RELEASES="$REMOTE_RELEASES"
REMOTE_CURRENT="$REMOTE_CURRENT"
SERVICE_NAME="$SERVICE_NAME"
JAR_LINK_NAME="$JAR_LINK_NAME"
RELEASE_NAME="$RELEASE_NAME"
LOCAL_PORT="$LOCAL_PORT"

NEW_JAR="\$REMOTE_RELEASES/\$RELEASE_NAME"
CURRENT_JAR="\$REMOTE_CURRENT/\$JAR_LINK_NAME"

echo "======================================"
echo " Remote SketchyDraw Deploy Started"
echo "======================================"

echo "Remote user:"
whoami

echo "New release:"
echo "\$NEW_JAR"

if [ ! -f "\$NEW_JAR" ]; then
  echo "ERROR: New jar not found: \$NEW_JAR"
  exit 1
fi

echo "Setting uploaded jar permission..."
chmod 644 "\$NEW_JAR"

OLD_TARGET=""
if [ -L "\$CURRENT_JAR" ]; then
  OLD_TARGET=\$(readlink -f "\$CURRENT_JAR")
  echo "Old release: \$OLD_TARGET"
else
  echo "Old release: none"
fi

echo "Updating current symlink..."
ln -sfn "\$NEW_JAR" "\$CURRENT_JAR"

CURRENT_TARGET=\$(readlink -f "\$CURRENT_JAR")

echo "Current symlink now points to:"
echo "\$CURRENT_TARGET"

if [ "\$CURRENT_TARGET" != "\$NEW_JAR" ]; then
  echo "ERROR: Current symlink is wrong"
  echo "Expected: \$NEW_JAR"
  echo "Actual:   \$CURRENT_TARGET"
  exit 1
fi

echo "Restarting \$SERVICE_NAME..."
sudo -n /usr/bin/systemctl restart "\$SERVICE_NAME"

echo "Waiting for service startup..."
sleep 12

SERVICE_STATUS=\$(/usr/bin/systemctl is-active "\$SERVICE_NAME" || true)
echo "Service status: \$SERVICE_STATUS"

if [ "\$SERVICE_STATUS" != "active" ]; then
  echo "ERROR: Service is not active"
  exit 1
fi

echo "Checking app is local-only on port \$LOCAL_PORT..."
PORT_LINE=\$(/usr/bin/ss -ltn | grep ":\$LOCAL_PORT" || true)

if [ -z "\$PORT_LINE" ]; then
  echo "ERROR: Port \$LOCAL_PORT is not listening"
  exit 1
fi

echo "\$PORT_LINE"

if echo "\$PORT_LINE" | grep -q "0.0.0.0:\$LOCAL_PORT"; then
  echo "ERROR: App is public on 0.0.0.0:\$LOCAL_PORT"
  echo "Fix env: SERVER_ADDRESS=127.0.0.1"
  exit 1
fi

if echo "\$PORT_LINE" | grep -q "\\[::\\]:\$LOCAL_PORT"; then
  echo "ERROR: App is public on IPv6 [::]:\$LOCAL_PORT"
  echo "Fix env: SERVER_ADDRESS=127.0.0.1"
  exit 1
fi

if ! echo "\$PORT_LINE" | grep -q "127.0.0.1:\$LOCAL_PORT"; then
  echo "ERROR: Expected 127.0.0.1:\$LOCAL_PORT only"
  echo "Actual:"
  echo "\$PORT_LINE"
  exit 1
fi

echo "======================================"
echo " SketchyDraw Deploy Successful"
echo " Release: \$NEW_JAR"
echo " Current: \$CURRENT_TARGET"
echo " Port:    127.0.0.1:\$LOCAL_PORT only"
echo "======================================"
EOF

echo "======================================"
echo " API Deploy Successful"
echo " Release: $RELEASE_NAME"
echo "======================================"