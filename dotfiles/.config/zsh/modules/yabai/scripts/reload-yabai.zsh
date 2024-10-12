#!/usr/bin/env zsh

source ~/.config/zsh/utils.sh

if [[ "$1" == "force" ]]; then
  print_start "Force reloading Yabai"
  killall yabai 2>/dev/null
else
  print_start "Reloading Yabai"
fi

yabai --restart-service

print_success "Yabai Reloaded!"
