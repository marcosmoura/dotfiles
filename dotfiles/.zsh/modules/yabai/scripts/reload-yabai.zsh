#!/usr/bin/env zsh

source ~/.zsh/utils.sh

launchctl kickstart -k "gui/${UID}/homebrew.mxcl.yabai"

print_success "Yabai Reloaded!"
