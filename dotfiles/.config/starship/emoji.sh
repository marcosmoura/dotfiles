#!/usr/bin/env zsh

function random_emoji {
  printf "%s\0" "$@" | shuf -z -n1 | tr -d '\0'
}

function current_emoji {
  local day=$(date +%d)
  local month=$(date +%m)
  local day_of_week=$(date +%u)

  day=${day#0}
  month=${month#0}

  if [[ $day_of_week -eq 2 && $day -eq 13 ]]; then
    # Friday the 13th
    random_emoji "👻" "💀"
  # elif [[ $month -eq 2 && $day -eq 14 ]]; then
  #   # valentines day
  #   random_emoji "💌" "❤️" "🧡" "💛" "💚" "💙" "💜" "❣️" "💕" "💞" "💓" "💗" "💖" "💘" "💝"
  elif [[ $month -eq 10 ]]; then
    # halloween
    random_emoji "👹" "👺" "👻" "💀" "🎃" "🧛🏻‍♂️" "🧟‍♂️" "🕷" "🕸"
  elif [[ $month -eq 10 && $day -eq 15 ]]; then
    # birthday
    echo "🎂"
  elif [[ $month -eq 12 && $day -le 25 ]]; then
    # christmas
    random_emoji "🎅🏻" "🎄" "🎁" "☃️" "⛄️"
  elif [[ $month -eq 12 && $day -eq 31 ]]; then
    # new years eve
    random_emoji "🍾" "🥂" "🎊" "🎉"
  fi
}

current_emoji
