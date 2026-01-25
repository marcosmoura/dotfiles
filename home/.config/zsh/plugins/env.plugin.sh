#!/usr/bin/env bash

# Rust - already loaded in .zshenv, skip if PATH already contains cargo
if [[ ! "$PATH" == *".cargo/bin"* ]]; then
  source $HOME/.cargo/env
fi

# Luarocks - defer to avoid blocking startup
eval "$(luarocks path)"

# SSH Agent - only start if not already running
if [[ -z "$(pgrep -u $USER ssh-agent)" ]]; then
  eval "$(ssh-agent -s)"
fi
