#!/usr/bin/env bash
set -e

BUMP="${1:-patch}"

echo "Bumping versions ($BUMP)..."
npm -w packages/core version "$BUMP" --no-git-tag-version
npm -w packages/studio version "$BUMP" --no-git-tag-version
npm -w packages/shadows version "$BUMP" --no-git-tag-version

echo "Building..."
npm run build

echo "Publishing @designtools/core..."
npm -w packages/core publish --access public

echo "Publishing @designtools/studio..."
npm -w packages/studio publish --access public

echo "Publishing @designtools/shadows..."
npm -w packages/shadows publish --access public

echo "Done."
