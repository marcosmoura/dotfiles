#!/usr/bin/env bash

# Rust - already loaded in .zshenv, skip if PATH already contains cargo
if [[ ! "$PATH" == *".cargo/bin"* ]]; then
  source $HOME/.cargo/env
fi

# Luarocks - cache paths to avoid slow startup
if [[ -z "$LUA_PATH" ]] && command -v luarocks >/dev/null 2>&1; then
  eval "$(luarocks path)"
fi

# SSH Agent - only start if not already running
if [[ -z "${SSH_AUTH_SOCK:-}" ]] && command -v ssh-agent >/dev/null 2>&1; then
  if ! pgrep -u "$USER" ssh-agent >/dev/null 2>&1; then
    eval "$(ssh-agent -s)"
  fi
fi

# direnv - load project-specific environment variables
if command -v direnv &>/dev/null; then
  eval "$(direnv hook zsh)"
fi
