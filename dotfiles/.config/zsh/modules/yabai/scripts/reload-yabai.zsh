#!/usr/bin/env zsh

source ~/.config/zsh/utils.sh

node ~/.config/zsh/modules/yabai/bin/wallpaper-manager clean
yabai --restart-service

print_success "Yabai Reloaded!"
