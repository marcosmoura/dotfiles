#!/bin/sh

# The $NAME variable is passed from sketchybar and holds the name of
# the item invoking this script:
# https://felixkratz.github.io/SketchyBar/config/events#events-and-scripting

# The date command is used to get the current date and time
# Format: Tue Nov 24 14:15:00
sketchybar --set "$NAME" label="$(date '+%a %b %d %H:%M:%S')"
