#!/bin/bash

WALLPAPER_DIR="$HOME/.config/wallpapers"
TMP_DIR="/tmp/wallpapers"
RADIUS=0

FORCE=false

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --radius) RADIUS="$2"; shift 2 ;;
      --force)  FORCE=true; shift ;;
      *) echo "Unknown option: $1" && exit 1 ;;
    esac
  done
}

get_screen_info() {
  SCREEN_INFO=$(osascript -e 'tell application "Finder" to get bounds of window of desktop')
  SCREEN_W=$(echo "$SCREEN_INFO" | awk -F', ' '{print $3}')
  SCREEN_H=$(echo "$SCREEN_INFO" | awk -F', ' '{print $4}')
  MENUBAR_H=$(osascript -l JavaScript -e '
    ObjC.import("AppKit");
    var screen = $.NSScreen.mainScreen;
    var fh = screen.frame.size.height;
    var vf = screen.visibleFrame;
    parseInt(fh - (vf.origin.y + vf.size.height));
  ')
  CONTENT_H=$((SCREEN_H - MENUBAR_H))
}

WALLPAPER_CACHED=false

process_wallpaper() {
  local wallpaper_path="$1"
  local name
  name=$(basename "$wallpaper_path")
  local output_path="$TMP_DIR/${name%.*}_${SCREEN_W}x${SCREEN_H}_r${RADIUS}_mb${MENUBAR_H}.png"

  if [ -f "$output_path" ] && ! $FORCE; then
    WALLPAPER_CACHED=true
  else
    WALLPAPER_CACHED=false
    local img_w img_h
    img_w=$(sips --getProperty pixelWidth "$wallpaper_path" | awk '/pixelWidth:/{print $2}')
    img_h=$(sips --getProperty pixelHeight "$wallpaper_path" | awk '/pixelHeight:/{print $2}')

    if [ "$RADIUS" -eq 0 ]; then
      magick "$wallpaper_path" \
        -resize "${SCREEN_W}x${CONTENT_H}!" \
        -background black -gravity South -extent "${SCREEN_W}x${SCREEN_H}" \
        "$output_path"
    else
      local scaled_r
      scaled_r=$(python3 -c "print(round($RADIUS * $img_w / $SCREEN_W))")
      magick \
        \( -size "${img_w}x${img_h}" xc:black -fill white -draw "roundrectangle 0,0 $((img_w - 1)),$((img_h - 1)) ${scaled_r},${scaled_r}" -alpha copy \) \
        \( "$wallpaper_path" \) \
        -compose SrcIn -composite \
        -background black -flatten -alpha off \
        -resize "${SCREEN_W}x${CONTENT_H}!" \
        -background black -gravity South -extent "${SCREEN_W}x${SCREEN_H}" \
        "$output_path"
    fi
  fi

  WALLPAPER_OUTPUT_PATH="$output_path"
}

cmd_set() {
  parse_args "$@"
  mkdir -p "$TMP_DIR"
  get_screen_info

  local wallpaper
  wallpaper=$(ls "$WALLPAPER_DIR" | shuf -n 1)
  process_wallpaper "$WALLPAPER_DIR/$wallpaper"
  local output_path="$WALLPAPER_OUTPUT_PATH"

  if $WALLPAPER_CACHED; then
    echo "$wallpaper — cached"
  else
    echo "$wallpaper — generated"
  fi

  osascript -e "tell application \"System Events\" to tell every desktop to set picture to \"$output_path\""
}

cmd_generate_all() {
  parse_args "$@"
  mkdir -p "$TMP_DIR"
  get_screen_info

  local files total processed
  files=($(ls "$WALLPAPER_DIR" | sort -V))
  total=${#files[@]}
  processed=0

  for name in "${files[@]}"; do
    processed=$((processed + 1))
    process_wallpaper "$WALLPAPER_DIR/$name"
    if $WALLPAPER_CACHED; then
      echo "[$processed/$total] $name — cached"
    else
      echo "[$processed/$total] $name — generated"
    fi
  done

  echo "Done. $total wallpapers ready."
}

cmd_clear_cache() {
  rm -rf "$TMP_DIR"
  echo "Cache cleared."
}

case "$1" in
  set)          cmd_set "${@:2}" ;;
  generate-all) cmd_generate_all "${@:2}" ;;
  clear-cache)  cmd_clear_cache ;;
  *)            echo "Usage: wallpaper.sh <set|generate-all|clear-cache> [--radius N]" && exit 1 ;;
esac
