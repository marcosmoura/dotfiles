#!/usr/bin/env bash

# Output a clock glyph representing the current hour (12-hour analog).
# Uses caching to avoid recalculation within the same hour.

set -o nounset

CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/starship"
CACHE_FILE="$CACHE_DIR/clock_cache"

declare -a CLOCK_GLYPHS=(
  "󱑊" "󱐿" "󱑀" "󱑁" "󱑂" "󱑃" "󱑄" "󱑅" "󱑆" "󱑇" "󱑈" "󱑉"
)

hour=$(date +%H)
idx=$((10#$hour % 12))

# Check if cache is valid (same hour)
if [[ -f "$CACHE_FILE" ]]; then
  cached_hour=$(cat "$CACHE_FILE" 2>/dev/null | head -1)
  cached_glyph=$(cat "$CACHE_FILE" 2>/dev/null | tail -1)
  if [[ "$cached_hour" == "$hour" ]]; then
    printf '%s' "$cached_glyph"
    exit 0
  fi
fi

# Update cache
mkdir -p "$CACHE_DIR"
glyph="${CLOCK_GLYPHS[$idx]}"
printf '%s\n%s' "$hour" "$glyph" >"$CACHE_FILE"
printf '%s' "$glyph"
