#!/usr/bin/env zsh

# Open zsh config
alias dotfiles="code ~/Projects/dotfiles"

# Open zsh config
alias zshconfig="code ~/.zshrc"

# Reload the shell (i.e. invoke as a login shell)
alias reload="exec $SHELL -l"

# Reload Yabai config
alias reloadYabai='launchctl kickstart -k "gui/${UID}/homebrew.mxcl.yabai"'
