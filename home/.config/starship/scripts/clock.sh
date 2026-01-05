#!/usr/bin/env bash

# Output a clock glyph representing the current hour (12‑hour analog).

set -o nounset

declare -a CLOCK_GLYPHS=(
  "" "" "" "" "" "" "" "" "" "" "" ""
)

hour=$(date +%H)
idx=$((10#$hour % 12))
printf '%s' "${CLOCK_GLYPHS[$idx]}"
