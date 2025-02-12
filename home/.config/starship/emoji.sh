#!/bin/bash

function emoji {
  function random_emoji {
    printf "%s\0" "$@" | shuf -z -n1 | tr -d '\0'
  }

  day=$(date +%d)
  month=$(date +%m)
  day_of_week=$(date +%u)

  day=${day#0}
  month=${month#0}

  # birthday
  if [[ $month -eq 10 && $day -eq 15 ]]; then
    echo "🎂"
  # halloween
  elif [[ $month -eq 10 && $day -eq 31 ]]; then
    random_emoji "👹" "👺" "👻" "💀" "🎃" "🧛🏻‍♂️" "🧟‍♂️" "🕷" "🕸"
  # Friday the 13th
  elif [[ $day_of_week -eq 2 && $day -eq 13 ]]; then
    random_emoji "👻" "💀"
  # Christmas
  elif [[ $month -eq 12 && $day -le 25 ]]; then
    random_emoji "🎅🏻" "🎄" "🎁" "☃️" "⛄️"
  # new years eve
  elif [[ $month -eq 12 && $day -eq 31 ]]; then
    random_emoji "🍾" "🥂" "🎊" "🎉"
  # Fluent UI directory
  elif [[ $PWD =~ "fluent" ]]; then
    echo " 󰍲  "
  # Dotfiles
  elif [[ $PWD =~ "dotfiles" ]]; then
    echo "   "
  else
    echo " 󰉋  "
  fi
}

emoji
