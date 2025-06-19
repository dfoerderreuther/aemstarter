#!/bin/bash
# Launch the locally built AEM-Starter app from the build directory.

set -e

APP_NAME="AEM-Starter"
BUILD_DIR="out/AEM-Starter-darwin-arm64"
APP_PATH="$BUILD_DIR/$APP_NAME.app"

if [ ! -d "$APP_PATH" ]; then
  echo "ERROR: $APP_PATH not found. Build the application first with ./build.sh"
  exit 1
fi

echo "Launching $APP_NAME from $APP_PATH"
open "$APP_PATH" 