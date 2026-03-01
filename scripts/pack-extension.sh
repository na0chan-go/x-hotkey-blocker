#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
STAGE_DIR="$DIST_DIR/_stage"
VERSION="$(node -p "require('./manifest.json').version")"
ARCHIVE_NAME="x-hotkey-blocker-v${VERSION}.zip"
ARCHIVE_PATH="$DIST_DIR/$ARCHIVE_NAME"

rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"
mkdir -p "$DIST_DIR"

cp "$ROOT_DIR/manifest.json" "$STAGE_DIR/"
cp "$ROOT_DIR/content.js" "$STAGE_DIR/"
cp "$ROOT_DIR/popup.html" "$STAGE_DIR/"
cp "$ROOT_DIR/popup.js" "$STAGE_DIR/"

(
  cd "$STAGE_DIR"
  zip -qr "$ARCHIVE_PATH" .
)

rm -rf "$STAGE_DIR"

echo "Created: $ARCHIVE_PATH"
