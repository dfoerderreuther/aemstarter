#!/bin/bash

# Build and Install Script for AEM Starter
# This script builds the app and installs it directly to ~/Applications/

set -e  # Exit on any error

APP_NAME="AEM-Starter"
BUILD_DIR="out/AEM-Starter-darwin-arm64"
INSTALL_DIR="$HOME/Applications"

echo "🚀 Building AEM Starter..."
echo "=========================================="

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf out/ .vite/ node_modules/.cache 2>/dev/null || true

# Build the app
echo "🔨 Building application..."
NODE_NO_WARNINGS=1 npm run make

# Check if build was successful
if [ ! -d "$BUILD_DIR/$APP_NAME.app" ]; then
    echo "❌ Build failed - app not found at $BUILD_DIR/$APP_NAME.app"
    exit 1
fi

echo "✅ Build completed successfully!"

# Install to Applications
echo "📦 Installing to ~/Applications/..."

# Create Applications directory if it doesn't exist
mkdir -p "$INSTALL_DIR"

# Remove existing installation
if [ -d "$INSTALL_DIR/$APP_NAME.app" ]; then
    echo "🗑️  Removing existing installation..."
    rm -rf "$INSTALL_DIR/$APP_NAME.app"
fi

# Copy new version
echo "📋 Copying new version..."
cp -R "$BUILD_DIR/$APP_NAME.app" "$INSTALL_DIR/"

# Set proper permissions
echo "🔐 Setting permissions..."
chmod +x "$INSTALL_DIR/$APP_NAME.app/Contents/MacOS/$APP_NAME"

echo "=========================================="
echo "✅ Installation completed successfully!"
echo "🎉 $APP_NAME is now installed in ~/Applications/"
echo ""
echo "You can now:"
echo "  • Open from Applications folder"
echo "  • Launch with: open ~/Applications/$APP_NAME.app"
echo "  • Add to Dock by dragging from Applications folder"
echo ""
echo "Build size: $(du -sh "$INSTALL_DIR/$APP_NAME.app" | cut -f1)"
echo "==========================================" 