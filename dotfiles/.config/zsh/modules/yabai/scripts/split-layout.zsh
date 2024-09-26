#!/usr/bin/env zsh

source ~/.config/zsh/utils.sh

DIRECTION=$1

if [ -z "${DIRECTION}" ]; then
  print_error "No direction was provided."
  print_info "Usage: split-layout vertical|horizontal"
  exit 1
fi

IS_CURRENT_LAYOUT=$(yabai -m query --windows --window | jq --arg DIRECTION $DIRECTION -re '."split-type" != $DIRECTION')

if [ "$IS_CURRENT_LAYOUT" = true ]; then
  print_info "Already in $DIRECTION layout."
  exit 1
fi

yabai -m window --toggle split
yabai -m space --balance

print_success "Layout changed to $DIRECTION"
