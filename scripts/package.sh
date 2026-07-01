#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/manifest.json"
DIST="$ROOT/dist"
NAME="quit-youtube"

if [[ ! -f "$MANIFEST" ]]; then
  echo "error: manifest.json not found" >&2
  exit 1
fi

VERSION="$(
  grep -E '"version"[[:space:]]*:' "$MANIFEST" \
    | head -1 \
    | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/'
)"

if [[ -z "$VERSION" ]]; then
  echo "error: could not read version from manifest.json" >&2
  exit 1
fi

bash "$ROOT/scripts/validate.sh"

ZIP="$DIST/${NAME}-v${VERSION}.zip"
mkdir -p "$DIST"
rm -f "$ZIP"

(
  cd "$ROOT"
  zip -qr "$ZIP" \
    manifest.json \
    popup/ \
    content/ \
    styles/ \
    icons/icon16.png \
    icons/icon48.png \
    icons/icon128.png
)

echo "Created $ZIP ($(du -h "$ZIP" | cut -f1))"
