#!/usr/bin/env bash

# Print a context / date aware emoji for the Starship prompt.

emoji() {
  # Helper: pick a random element from arguments using $RANDOM
  random_emoji() {
    local items=("$@")
    local count=${#items[@]}
    ((count == 0)) && return 1
    local idx=$((RANDOM % count))
    printf '%s' "${items[$idx]}"
  }

  local day=$(date +%d)
  local month=$(date +%m)
  local dow=$(date +%u) # 1=Mon .. 7=Sun

  day=${day#0}
  month=${month#0}

  # ---- Date based picks ----
  if [[ $month -eq 1 && $day -eq 1 ]]; then
    random_emoji "🥳" "🎆" "🎇" "🍾" "🎉"
  elif [[ $month -eq 2 && $day -eq 14 ]]; then
    random_emoji "❤️" "💘" "💝" "🌹" "🥰"
  elif [[ $month -eq 10 && $day -eq 15 ]]; then
    printf '%s' "🎂" # Birthday
  elif [[ $month -eq 10 && $day -eq 31 ]]; then
    random_emoji "👹" "👺" "👻" "💀" "🎃" "🧛🏻‍♂️" "🧟‍♂️" "🕷" "🕸" # Halloween
  elif [[ $day -eq 13 && $dow -eq 5 ]]; then
    random_emoji "👻" "💀" # Friday the 13th
  elif [[ $month -eq 12 && $day -le 25 ]]; then
    random_emoji "🎅🏻" "🎄" "🎁" "☃️" "⛄️" # Advent / Christmas season
  elif [[ $month -eq 12 && $day -eq 31 ]]; then
    random_emoji "🍾" "🥂" "🎊" "🎉" # New Year's Eve
  # Weekend flair (Sat=6, Sun=7) — low precedence after major holidays.
  elif [[ $dow -ge 6 ]]; then
    random_emoji "😎" "🛌" "🏖" "📚"
  # ---- Directory context picks ----
  elif [[ $PWD == *"/fluent"* || $PWD == *"fluent-ui"* || $PWD == *"fluent"* ]]; then
    printf '%s' " 󰍲  "
  elif [[ $PWD == *"dotfiles"* ]]; then
    printf '%s' "   "
  else
    # General default icon (folder glyph variant)
    printf '%s' " 󰉋  "
  fi
}

emoji
