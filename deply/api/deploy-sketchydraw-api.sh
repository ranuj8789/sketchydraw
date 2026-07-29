#!/usr/bin/env bash
set -euo pipefail

SERVER_USER="ranuj"
SERVER_HOST="192.168.1.10"
SERVER_SSH_PORT="2222"

API_DIR="/Users/ranujmahajan/projects/sketchydraw/sketchdraw-api"

REMOTE_RELEASES="/mnt/media-nvme/sketchydraw/app/releases"
REMOTE_CURRENT="/mnt/media-nvme/sketchydraw/app/current"

SERVICE_NAME="sketchydraw-api"
CURRENT_JAR="$REMOTE_CURRENT/sketchydraw-api.jar"
LOCAL_PORT="8081"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
RELEASE_NAME="sketchydraw-api-${TIMESTAMP}.jar"
REMOTE_JAR="$REMOTE_RELEASES/$RELEASE_NAME"

echo "======================================"
echo " Deploying SketchyDraw API"
echo " Server: $SERVER_USER@$SERVER_HOST:$SERVER_SSH_PORT"
echo " Release: $RELEASE_NAME"
echo "======================================"

echo "Building application..."

cd "$API_DIR"
mvn clean package -DskipTests

LOCAL_JAR="$API_DIR/target/sketchydraw-api.jar"

if [ ! -f "$LOCAL_JAR" ]; then
    echo "ERROR: JAR not found:"
    echo "$LOCAL_JAR"
    exit 1
fi

echo "Build successful."
echo "Checking server connection..."

ssh -p "$SERVER_SSH_PORT" "$SERVER_USER@$SERVER_HOST" \
    "echo 'SSH connected as:' && whoami"

echo "Checking deployment folders..."

ssh -p "$SERVER_SSH_PORT" "$SERVER_USER@$SERVER_HOST" "
    test -d '$REMOTE_RELEASES' ||
    {
        echo 'ERROR: Releases folder missing';
        exit 1;
    }

    test -d '$REMOTE_CURRENT' ||
    {
        echo 'ERROR: Current folder missing';
        exit 1;
    }

    test -w '$REMOTE_RELEASES' ||
    {
        echo 'ERROR: ranuj cannot write to releases folder';
        exit 1;
    }

    test -w '$REMOTE_CURRENT' ||
    {
        echo 'ERROR: ranuj cannot write to current folder';
        exit 1;
    }
"

echo "Uploading JAR..."

scp -P "$SERVER_SSH_PORT" \
    "$LOCAL_JAR" \
    "$SERVER_USER@$SERVER_HOST:$REMOTE_JAR"

echo "Activating release..."

ssh -p "$SERVER_SSH_PORT" "$SERVER_USER@$SERVER_HOST" "
    set -e

    chmod 644 '$REMOTE_JAR'

    ln -sfn '$REMOTE_JAR' '$CURRENT_JAR'

    echo 'Current JAR:'
    readlink -f '$CURRENT_JAR'

    sudo -n systemctl restart '$SERVICE_NAME'

    sleep 12

    if ! systemctl is-active --quiet '$SERVICE_NAME'; then
        echo 'ERROR: SketchyDraw service failed'
        systemctl --no-pager --full status '$SERVICE_NAME' || true
        exit 1
    fi

    echo 'Service is active.'

    PORT_LINE=\$(ss -ltn | grep '127.0.0.1:$LOCAL_PORT' || true)

    if [ -z \"\$PORT_LINE\" ]; then
        echo 'ERROR: Application is not listening on 127.0.0.1:$LOCAL_PORT'
        ss -ltn | grep ':$LOCAL_PORT' || true
        exit 1
    fi

    echo \"\$PORT_LINE\"
"

echo "======================================"
echo " SketchyDraw API deployed successfully"
echo " Release: $RELEASE_NAME"
echo " Port: 127.0.0.1:$LOCAL_PORT"
echo "======================================"