#!/usr/bin/env bash

# Print a context / date aware emoji for the Starship prompt.
# Uses caching for date-based emojis to improve performance.
# PWD-based emojis are always dynamic.

set -e

CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/starship"
CACHE_FILE="$CACHE_DIR/emoji_cache"
CACHE_TTL=3600 # 1 hour in seconds

# Seed RANDOM for consistent selection within the same terminal session
if [[ -n "${STARSHIP_SESSION_KEY:-}" ]]; then
  RANDOM=$(printf '%d' "0x${STARSHIP_SESSION_KEY:0:8}" 2>/dev/null || echo "$$")
else
  RANDOM=$(date +%Y%m%d%H%M)
fi

# Helper: pick a random element from arguments and print it
random_emoji() {
  local -a items=("$@")
  local count=${#items[@]}
  [[ $count -eq 0 ]] && return 1
  local index=$((RANDOM % count))
  echo -n "${items[$index]}  "
}

# Get date info
day=$(date +%d)
month=$(date +%m)
dow=$(date +%u)
day=${day#0}
month=${month#0}

# Check if we should use a cached date-based emoji
use_cache() {
  [[ -f "$CACHE_FILE" ]] || return 1
  local cache_age
  if [[ "$OSTYPE" == "darwin"* ]]; then
    cache_age=$(($(date +%s) - $(stat -f %m "$CACHE_FILE" 2>/dev/null)))
  else
    cache_age=$(($(date +%s) - $(stat -c %Y "$CACHE_FILE" 2>/dev/null)))
  fi
  [[ $cache_age -lt $CACHE_TTL ]]
}

cache_emoji() {
  mkdir -p "$CACHE_DIR"
  echo -n "$1" >"$CACHE_FILE"
}

get_cached_emoji() {
  cat "$CACHE_FILE" 2>/dev/null
}

# PWD-based emojis (always dynamic, no caching)
if [[ "${PWD:-}" == *"fluent"* ]]; then
  echo -n "󰍲  "
  exit 0
elif [[ "${PWD:-}" == *"dotfiles"* ]]; then
  echo -n "󱃖  "
  exit 0
fi

# Date-based emojis (cached)
get_date_emoji() {
  if [[ $month -eq 1 && $day -eq 1 ]]; then
    random_emoji "🥳" "🎆" "🎇" "🍾" "🎉"
  elif [[ $month -eq 2 && $day -eq 14 ]]; then
    random_emoji "❤️" "💘" "💝" "🌹" "🥰"
  elif [[ $month -eq 10 && $day -eq 15 ]]; then
    random_emoji "🎂" "🎉" "🥳" "🎁"
  elif [[ $month -eq 10 && $day -eq 31 ]]; then
    random_emoji "👹" "👺" "👻" "💀" "🎃" "🧛🏻‍♂️" "🧟‍♂️" "🕷" "🕸"
  elif [[ $day -eq 13 && $dow -eq 5 ]]; then
    random_emoji "👻" "💀"
  elif [[ $month -eq 12 && $day -eq 25 ]]; then
    random_emoji "🎅🏻" "🎄" "🎁" "☃️" "⛄️"
  elif [[ $month -eq 12 && $day -eq 31 ]]; then
    random_emoji "🍾" "🥂" "🎊" "🎉"
  elif [[ $dow -ge 6 ]]; then
    random_emoji "😎" "🛌" "🏖" "📚"
  else
    echo -n "󰉋  "
  fi
}

# Use cached emoji if valid, otherwise generate and cache
if use_cache; then
  get_cached_emoji
else
  emoji=$(get_date_emoji)
  cache_emoji "$emoji"
  echo -n "$emoji"
fi
