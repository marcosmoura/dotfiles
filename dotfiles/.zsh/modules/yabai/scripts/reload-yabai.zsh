#!/usr/bin/env zsh

source ~/.zsh/utils.sh

node ~/.zsh/modules/yabai/bin/wallpaper-manager clean
launchctl kickstart -k "gui/${UID}/homebrew.mxcl.yabai"

print_success "Yabai Reloaded!"
