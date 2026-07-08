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

npm run bundle --prefix "$ROOT"
bash "$ROOT/scripts/validate.sh"

OUT="$DIST/${NAME}-v${VERSION}"
rm -rf "$OUT"
mkdir -p "$OUT"

cp "$ROOT/manifest.json" "$OUT/"
cp -R "$ROOT/popup" "$ROOT/content" "$ROOT/styles" "$OUT/"
mkdir -p "$OUT/background"
cp "$ROOT/background/service-worker.js" "$OUT/background/"
mkdir -p "$OUT/icons"
cp "$ROOT/icons/icon16.png" "$ROOT/icons/icon48.png" "$ROOT/icons/icon128.png" "$OUT/icons/"

echo "Built $OUT (load unpacked in chrome://extensions)"
