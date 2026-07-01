#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: bump-version.sh <patch|minor|major>" >&2
  exit 1
fi

PART="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/manifest.json"

CURRENT="$(
  grep -E '"version"[[:space:]]*:' "$MANIFEST" \
    | head -1 \
    | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/'
)"

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$PART" in
  patch) PATCH=$((PATCH + 1)) ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  *)
    echo "usage: bump-version.sh <patch|minor|major>" >&2
    exit 1
    ;;
esac

NEXT="${MAJOR}.${MINOR}.${PATCH}"

if [[ "$(uname)" == "Darwin" ]]; then
  sed -i '' -E "s/(\"version\"[[:space:]]*:[[:space:]]*\")[^\"]+(\")/\1${NEXT}\2/" "$MANIFEST"
else
  sed -i -E "s/(\"version\"[[:space:]]*:[[:space:]]*\")[^\"]+(\")/\1${NEXT}\2/" "$MANIFEST"
fi

echo "version: $CURRENT -> $NEXT"
