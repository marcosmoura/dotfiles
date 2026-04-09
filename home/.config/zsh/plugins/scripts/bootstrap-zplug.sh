#!/usr/bin/env bash
set -euo pipefail

export ZSH_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/zsh"
export ZPLUG_BOOTSTRAP_ONLY=1

exec zsh -lc '
  source "$ZSH_DIR/zplug.zsh"
  command -v zplug >/dev/null 2>&1
  if ! zplug check --verbose >/dev/null 2>&1; then
    zplug install
  fi
'
