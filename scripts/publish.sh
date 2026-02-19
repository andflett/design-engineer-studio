#!/usr/bin/env bash
set -e

BUMP="${1:-patch}"
shift 2>/dev/null || true

ALL_PACKAGES=(core studio shadows)

# If no packages specified, default to all
if [ $# -eq 0 ]; then
  PACKAGES=("${ALL_PACKAGES[@]}")
else
  PACKAGES=("$@")
fi

# Validate package names
for pkg in "${PACKAGES[@]}"; do
  case "$pkg" in
    core|studio|shadows) ;;
    *) echo "Unknown package: $pkg (valid: ${ALL_PACKAGES[*]})" && exit 1 ;;
  esac
done

echo "Bumping versions ($BUMP) for: ${PACKAGES[*]}"
for pkg in "${PACKAGES[@]}"; do
  npm -w "packages/$pkg" version "$BUMP" --no-git-tag-version
done

echo "Building..."
npm run build

echo "Publishing..."
for pkg in "${PACKAGES[@]}"; do
  echo "Publishing @designtools/$pkg..."
  npm -w "packages/$pkg" publish --access public
done

echo "Done."
