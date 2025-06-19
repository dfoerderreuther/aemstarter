#!/bin/bash
# Local build script for AEM-Starter

set -e

APP_NAME="AEM-Starter"
BUILD_DIR="out/AEM-Starter-darwin-arm64"
APP_PATH="$BUILD_DIR/$APP_NAME.app"

echo "Building $APP_NAME"
# Clean previous build artefacts
rm -rf out/ .vite/ node_modules/.cache 2>/dev/null || true

# Build using Electron Forge
NODE_NO_WARNINGS=1 npm run make

if [ ! -d "$APP_PATH" ]; then
  echo "ERROR: Build failed – $APP_PATH not found"
  exit 1
fi

# Remove macOS quarantine attributes so the app can start without warnings
xattr -cr "$APP_PATH" 2>/dev/null || true
# Ensure the main binary is executable
chmod +x "$APP_PATH/Contents/MacOS/$APP_NAME"

echo "Build finished: $APP_PATH"

echo "Run the application with ./run.sh" 