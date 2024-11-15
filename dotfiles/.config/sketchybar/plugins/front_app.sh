#!/bin/bash

# Some events send additional information specific to the event in the $INFO
# variable. E.g. the front_app_switched event sends the name of the newly
# focused application in the $INFO variable:
# https://felixkratz.github.io/SketchyBar/config/events#events-and-scripting

if [ "$SENDER" = "front_app_switched" ]; then
  item=(
    label="$INFO"
    padding_left=0
    padding_right=0
    icon.padding_left=0
    icon.padding_right=0
    label.padding_left=0
    label.padding_right=0
  )

  sketchybar --set "$NAME" "${item[@]}"
fi
