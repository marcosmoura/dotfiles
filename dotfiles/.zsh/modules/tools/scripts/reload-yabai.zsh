#!/usr/bin/env zsh

source ~/.zsh/utils.sh
source ~/.zsh/modules/tools/tools.plugin.zsh

launchctl kickstart -k "gui/${UID}/homebrew.mxcl.yabai"

print_success "Yabai Reloaded!"
