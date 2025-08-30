#!/usr/bin/env bash
# dist.sh — create clean dist/ dir and zip for Chrome Web Store
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Clean
rm -rf dist volition-dist.zip
mkdir dist

# Copy everything except dev/builder files and heavy/unused assets
rsync -a ./ dist/ \
  --exclude ".git" \
  --exclude "dist" \
  --exclude "node_modules" \
  --exclude "*.zip" \
  --exclude "*.DS_Store" \
  # Exclude docs and large media
  --exclude "docs/" \
  --exclude "docs/**" \
  --exclude "*.mp4" \
  --exclude "*.mov" \
  --exclude "*.avi" \
  --exclude "*.gif" \
  # Exclude unused icon variants/logos (keep icon16/32/48/128 only)
  --exclude "icons/volition_*" \
  --exclude "icons/*.svg"

# Create ZIP
cd dist
zip -r ../volition-dist.zip . -x "*.DS_Store"

echo "Created volition-dist.zip in project root." 