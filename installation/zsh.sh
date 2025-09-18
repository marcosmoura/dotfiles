#!/usr/bin/env bash

print_start "Configuring zsh"

ZSH_DIR=$(command -v zsh)

if ! grep -Fxq "$ZSH_DIR" /etc/shells; then
  print_progress "Adding zsh to /etc/shells"
  echo "$ZSH_DIR" | sudo tee -a /etc/shells >/dev/null
fi

if [ "$SHELL" != "$ZSH_DIR" ]; then
  print_progress "Setting as default shell"
  chsh -s "$ZSH_DIR"
fi

if ! command -v sheldon >/dev/null 2>&1; then
  brew install sheldon || true
fi

if command -v sheldon >/dev/null 2>&1; then
  print_progress "Refreshing sheldon plugins"
  sheldon lock --reinstall || true
fi

print_success "zsh configured!"
