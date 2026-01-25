#!/usr/bin/env bash

# Print a context / date aware emoji for the Starship prompt.
# Uses STARSHIP_SESSION_KEY for consistent random selection within a session.

set -e

# Seed RANDOM for consistent selection within the same terminal session
if [[ -n "$STARSHIP_SESSION_KEY" ]]; then
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

day=$(date +%d)
month=$(date +%m)
dow=$(date +%u)

day=${day#0}
month=${month#0}

# Date based picks
if [[ $month -eq 1 && $day -eq 1 ]]; then
	# New Year's Day
	random_emoji "🥳" "🎆" "🎇" "🍾" "🎉"
elif [[ $month -eq 2 && $day -eq 14 ]]; then
	# Valentine's Day
	random_emoji "❤️" "💘" "💝" "🌹" "🥰"
elif [[ $month -eq 10 && $day -eq 15 ]]; then
	# Birthday
	random_emoji "🎂" "🎉" "🥳" "🎁"
elif [[ $month -eq 10 && $day -eq 31 ]]; then
	# Halloween
	random_emoji "👹" "👺" "👻" "💀" "🎃" "🧛🏻‍♂️" "🧟‍♂️" "🕷" "🕸"
elif [[ $day -eq 13 && $dow -eq 5 ]]; then
	# Friday the 13th
	random_emoji "👻" "💀"
elif [[ $month -eq 12 && $day -eq 25 ]]; then
	# Christmas
	random_emoji "🎅🏻" "🎄" "🎁" "☃️" "⛄️"
elif [[ $month -eq 12 && $day -eq 31 ]]; then
	# New Year's Eve
	random_emoji "🍾" "🥂" "🎊" "🎉"
elif [[ $dow -ge 6 ]]; then
	# Weekend
	random_emoji "😎" "🛌" "🏖" "📚"
elif [[ $PWD == *"fluent"* ]]; then
	# Fluent repository
	echo -n "󰍲  "
elif [[ $PWD == *"dotfiles"* ]]; then
	# Dotfiles repository
	echo -n "󱃖  "
else
	# Default
	echo -n "󰉋  "
fi
