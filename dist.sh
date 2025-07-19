#!/usr/bin/env bash
# dist.sh — create clean dist/ dir and zip for Chrome Web Store
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Clean
rm -rf dist gpt-focus-blocker-dist.zip
mkdir dist

# Copy everything except dev/builder files
rsync -a ./ dist/ \
  --exclude ".git" \
  --exclude "dist" \
  --exclude "node_modules" \
  --exclude "*.zip" \
  --exclude "*.DS_Store"

# Create ZIP
cd dist
zip -r ../gpt-focus-blocker-dist.zip . -x "*.DS_Store"

echo "Created gpt-focus-blocker-dist.zip in project root." 