#!/usr/bin/env bash
# dist.sh — create clean dist/ dir and zip for Chrome Web Store
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Clean
rm -rf dist volition-dist.zip
mkdir dist

# Copy the extension source while excluding repository metadata, development files,
# and heavy/unused assets. Chrome receives only this ZIP, so keep credentials and
# CI configuration out of it as well.
rsync -a ./ dist/ \
  --exclude ".git" \
  --exclude ".github" \
  --exclude ".agents" \
  --exclude ".codex" \
  --exclude "dist" \
  --exclude "node_modules" \
  --exclude "tests/" \
  --exclude "*.zip" \
  --exclude "*.DS_Store" \
  --exclude "docs/" \
  --exclude "docs/**" \
  --exclude "*.mp4" \
  --exclude "*.mov" \
  --exclude "*.avi" \
  --exclude "*.gif" \
  --exclude "icons/volition_*" \
  --exclude "icons/*.svg"

# Create ZIP
cd dist
zip -r ../volition-dist.zip . -x "*.DS_Store"

echo "Created volition-dist.zip in project root."
