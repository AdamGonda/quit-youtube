#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/manifest.json"
ERRORS=0

fail() {
  echo "error: $1" >&2
  ERRORS=$((ERRORS + 1))
}

require_file() {
  if [[ ! -f "$1" ]]; then
    fail "missing file: $1"
  fi
}

require_file "$MANIFEST"
require_file "$ROOT/popup/popup.html"
require_file "$ROOT/popup/popup.js"
require_file "$ROOT/icons/icon16.png"
require_file "$ROOT/icons/icon48.png"
require_file "$ROOT/icons/icon128.png"
require_file "$ROOT/styles/attention-shield.css"

for script in \
  content/bootstrap.js \
  content/avatar-cache.js \
  content/card-types.js \
  content/extractors.js \
  content/transcripts.js \
  content/feed-cleanup.js \
  content/transform.js \
  content/observer.js \
  content/content.js \
  content/page-bridge.js
do
  require_file "$ROOT/$script"
done

if ! grep -q '"manifest_version"[[:space:]]*:[[:space:]]*3' "$MANIFEST"; then
  fail "manifest_version must be 3"
fi

VERSION="$(
  grep -E '"version"[[:space:]]*:' "$MANIFEST" \
    | head -1 \
    | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/'
)"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  fail "version must be semver (e.g. 1.2.3), got: ${VERSION:-<empty>}"
fi

if [[ "$ERRORS" -gt 0 ]]; then
  echo "validation failed with $ERRORS error(s)" >&2
  exit 1
fi

echo "validation passed (v$VERSION)"
