#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "iOS builds require macOS and Xcode." >&2
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ARCHIVE_PATH="$PROJECT_DIR/release/ios/FloatingVideoPlayer.xcarchive"
EXPORT_PATH="$PROJECT_DIR/release/ios/export"

cd "$PROJECT_DIR"
npm run ios:sync
mkdir -p "$PROJECT_DIR/release/ios" "$EXPORT_PATH"

xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  -allowProvisioningUpdates \
  archive

xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist ios/ExportOptions.development.plist \
  -allowProvisioningUpdates

echo "Export completed: $EXPORT_PATH"
