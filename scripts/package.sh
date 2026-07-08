#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/manifest.json"
DIST="$ROOT/dist"
NAME="quit-youtube"

VERSION="$(
  grep -E '"version"[[:space:]]*:' "$MANIFEST" \
    | head -1 \
    | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/'
)"

bash "$ROOT/scripts/build.sh"

ZIP="$DIST/${NAME}-v${VERSION}.zip"
rm -f "$ZIP"

(
  cd "$DIST/${NAME}-v${VERSION}"
  zip -qr "$ZIP" .
)

echo "Created $ZIP ($(du -h "$ZIP" | cut -f1))"
