#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

WALLPAPER_DIR="$HOME/.config/wallpapers"
TMP_DIR="/tmp/wallpapers"
RADIUS=0
FORCE=false
RANDOMIZE=false
WALLPAPER_CACHED=false
WALLPAPER_OUTPUT_PATH=""
SCREEN_W=0
SCREEN_H=0
MENUBAR_H=0
CONTENT_H=0
WALLPAPER_FILES=()
SELECTED_WALLPAPER=""

usage() {
  echo "Usage: wallpaper.sh set <filename|--random> [--radius N] [--force]" >&2
  echo "       wallpaper.sh generate-all [--radius N] [--force]" >&2
  echo "       wallpaper.sh clear-cache" >&2
}

fail() {
  echo "$1" >&2
  exit 1
}

require_command() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "Missing required command: $cmd"
}

parse_args() {
  local mode="$1"
  shift

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --radius)
        [ "$#" -ge 2 ] || fail "Missing value for --radius"
        [[ "$2" =~ ^[0-9]+$ ]] || fail "Radius must be a non-negative integer"
        RADIUS="$2"
        shift 2
        ;;
      --force)
        FORCE=true
        shift
        ;;
      --random)
        [ "$mode" = "set" ] || fail "Unknown option: $1"
        RANDOMIZE=true
        shift
        ;;
      --*)
        fail "Unknown option: $1"
        ;;
      *)
        [ "$mode" = "set" ] || fail "Unknown option: $1"
        [ -z "$SELECTED_WALLPAPER" ] || fail "Specify only one wallpaper filename"
        SELECTED_WALLPAPER="$1"
        shift
        ;;
    esac
  done

  if [ "$mode" = "set" ]; then
    if [ "$RANDOMIZE" = true ] && [ -n "$SELECTED_WALLPAPER" ]; then
      fail "Use either a filename or --random, not both"
    fi
    if [ "$RANDOMIZE" = false ] && [ -z "$SELECTED_WALLPAPER" ]; then
      fail "set requires a filename or --random"
    fi
  fi
}

load_wallpapers() {
  [ -d "$WALLPAPER_DIR" ] || fail "Wallpaper directory not found: $WALLPAPER_DIR"

  WALLPAPER_FILES=()
  local path
  shopt -s nullglob
  for path in "$WALLPAPER_DIR"/*; do
    [ -f "$path" ] || continue
    WALLPAPER_FILES+=("$path")
  done
  shopt -u nullglob

  [ "${#WALLPAPER_FILES[@]}" -gt 0 ] || fail "No wallpapers found in $WALLPAPER_DIR"
}

sort_wallpapers() {
  local sorter=""
  local -a sorted=()

  if command -v gsort >/dev/null 2>&1; then
    sorter="gsort"
  elif sort -V </dev/null >/dev/null 2>&1; then
    sorter="sort"
  fi

  [ -n "$sorter" ] || return

  while IFS= read -r path; do
    sorted+=("$path")
  done < <(printf '%s\n' "${WALLPAPER_FILES[@]}" | "$sorter" -V)

  if [ "${#sorted[@]}" -gt 0 ]; then
    WALLPAPER_FILES=("${sorted[@]}")
  fi
}

pick_random_wallpaper() {
  local picker=""

  if command -v shuf >/dev/null 2>&1; then
    picker="shuf"
  elif command -v gshuf >/dev/null 2>&1; then
    picker="gshuf"
  fi

  if [ -n "$picker" ]; then
    printf '%s\n' "${WALLPAPER_FILES[@]}" | "$picker" -n 1
    return
  fi

  printf '%s\n' "${WALLPAPER_FILES[RANDOM % ${#WALLPAPER_FILES[@]}]}"
}

resolve_wallpaper_path() {
  local input="$1"
  local candidate="$WALLPAPER_DIR/$input"

  [ -f "$candidate" ] || fail "Wallpaper not found: $input"

  printf '%s\n' "$candidate"
}

prepare_environment() {
  require_command osascript
  require_command sips
  require_command magick
}

get_screen_info() {
  local screen_info
  screen_info=$(osascript -e 'tell application "Finder" to get bounds of window of desktop')
  SCREEN_W=$(echo "$screen_info" | awk -F', ' '{print $3}')
  SCREEN_H=$(echo "$screen_info" | awk -F', ' '{print $4}')
  MENUBAR_H=$(osascript -l JavaScript -e '
    ObjC.import("AppKit");
    var screen = $.NSScreen.mainScreen;
    var fh = screen.frame.size.height;
    var vf = screen.visibleFrame;
    parseInt(fh - (vf.origin.y + vf.size.height));
  ')

  [[ "$SCREEN_W" =~ ^[0-9]+$ ]] || fail "Failed to determine screen width"
  [[ "$SCREEN_H" =~ ^[0-9]+$ ]] || fail "Failed to determine screen height"
  [[ "$MENUBAR_H" =~ ^[0-9]+$ ]] || fail "Failed to determine menu bar height"

  CONTENT_H=$((SCREEN_H - MENUBAR_H))
}

process_wallpaper() {
  local wallpaper_path="$1"
  local name output_path img_w img_h

  name=$(basename "$wallpaper_path")
  output_path="$TMP_DIR/${name%.*}_${SCREEN_W}x${SCREEN_H}_r${RADIUS}_mb${MENUBAR_H}.png"

  if [ -f "$output_path" ] && [ "$FORCE" = false ]; then
    WALLPAPER_CACHED=true
    WALLPAPER_OUTPUT_PATH="$output_path"
    return
  fi

  WALLPAPER_CACHED=false

  if [ "$RADIUS" -eq 0 ]; then
    magick "$wallpaper_path" \
      -resize "${SCREEN_W}x${CONTENT_H}!" \
      -background black -gravity South -extent "${SCREEN_W}x${SCREEN_H}" \
      "$output_path"
  else
    img_w=$(sips --getProperty pixelWidth "$wallpaper_path" | awk '/pixelWidth:/{print $2}')
    img_h=$(sips --getProperty pixelHeight "$wallpaper_path" | awk '/pixelHeight:/{print $2}')
    local scaled_r
    scaled_r=$(awk -v radius="$RADIUS" -v image_width="$img_w" -v screen_width="$SCREEN_W" 'BEGIN { printf "%.0f", radius * image_width / screen_width }')
    magick \
      \( -size "${img_w}x${img_h}" xc:black -fill white -draw "roundrectangle 0,0 $((img_w - 1)),$((img_h - 1)) ${scaled_r},${scaled_r}" -alpha copy \) \
      \( "$wallpaper_path" \) \
      -compose SrcIn -composite \
      -background black -flatten -alpha off \
      -resize "${SCREEN_W}x${CONTENT_H}!" \
      -background black -gravity South -extent "${SCREEN_W}x${SCREEN_H}" \
      "$output_path"
  fi

  WALLPAPER_OUTPUT_PATH="$output_path"
}

set_wallpaper() {
  local output_path="$1"

  osascript <<EOF
tell application "System Events"
  tell every desktop to set picture to POSIX file "$output_path"
end tell
EOF
}

cmd_set() {
  parse_args "set" "$@"
  prepare_environment
  load_wallpapers
  mkdir -p "$TMP_DIR"
  get_screen_info

  local wallpaper_path output_path wallpaper_name
  if [ "$RANDOMIZE" = true ]; then
    wallpaper_path=$(pick_random_wallpaper)
  else
    wallpaper_path=$(resolve_wallpaper_path "$SELECTED_WALLPAPER")
  fi
  process_wallpaper "$wallpaper_path"
  output_path="$WALLPAPER_OUTPUT_PATH"
  wallpaper_name=$(basename "$wallpaper_path")

  if [ "$WALLPAPER_CACHED" = true ]; then
    echo "$wallpaper_name — cached"
  else
    echo "$wallpaper_name — generated"
  fi

  set_wallpaper "$output_path"
}

cmd_generate_all() {
  parse_args "generate-all" "$@"
  prepare_environment
  load_wallpapers
  sort_wallpapers
  mkdir -p "$TMP_DIR"
  get_screen_info

  local total processed wallpaper_path wallpaper_name
  total=${#WALLPAPER_FILES[@]}
  processed=0

  for wallpaper_path in "${WALLPAPER_FILES[@]}"; do
    processed=$((processed + 1))
    process_wallpaper "$wallpaper_path"
    wallpaper_name=$(basename "$wallpaper_path")
    if [ "$WALLPAPER_CACHED" = true ]; then
      echo "[$processed/$total] $wallpaper_name — cached"
    else
      echo "[$processed/$total] $wallpaper_name — generated"
    fi
  done

  echo "Done. $total wallpapers ready."
}

cmd_clear_cache() {
  rm -rf "$TMP_DIR"
  echo "Cache cleared."
}

case "${1:-}" in
  set)
    cmd_set "${@:2}"
    ;;
  generate-all)
    cmd_generate_all "${@:2}"
    ;;
  clear-cache)
    cmd_clear_cache
    ;;
  *)
    usage
    exit 1
    ;;
esac
