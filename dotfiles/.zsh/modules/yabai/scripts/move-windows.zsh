#!/usr/bin/env zsh

source ~/.zsh/utils.sh

DIRECTION=$1

if [ -z "${DIRECTION}" ]; then
  print_error "No direction was provided."
  print_info "Usage: move-windows left|right|up|down"
  exit 1
fi

print_start "Moving window to the $DIRECTION"

IS_FLOATING=$(yabai -m query --windows --window | jq '.["is-floating"] == true')
GRID_VALUE=""
OUTPUT=""

if [ $DIRECTION = "top" ]; then
  DIRECTION="north"
  GRID_VALUE="1:1:0:0:1:1"
elif [ $DIRECTION = "right" ]; then
  DIRECTION="east"
  GRID_VALUE="1:2:1:0:1:1"
elif [ $DIRECTION = "bottom" ]; then
  DIRECTION="south"
  GRID_VALUE="2560:2560:320:320:1920:1920"
elif [ $DIRECTION = "left" ]; then
  DIRECTION="west"
  GRID_VALUE="1:2:0:0:1:1"
fi

if [ "$IS_FLOATING" = true ]; then
  OUTPUT=$(yabai -m window --grid $GRID_VALUE 2>&1)
else
  OUTPUT=$(yabai -m window --swap $DIRECTION 2>&1)
fi

if [[ "$OUTPUT" == *"could not"* ]]; then
  print_error "$OUTPUT"
else
  print_success "Done!"
fi
