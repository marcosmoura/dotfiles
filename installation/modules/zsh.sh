#!/usr/bin/env bash
set -euo pipefail

# Ensure utils are loaded
if ! command -v log_step &>/dev/null; then
  source "${DOTFILES_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/installation/lib/utils.sh"
fi

log_step "Configuring zsh"

ZSH_PATH="$(command -v zsh)"

if ! grep -Fxq "$ZSH_PATH" /etc/shells; then
  log_progress "Adding zsh to /etc/shells"
  echo "$ZSH_PATH" | sudo tee -a /etc/shells >/dev/null
fi

if [ "$SHELL" != "$ZSH_PATH" ]; then
  log_progress "Setting zsh as default shell"
  chsh -s "$ZSH_PATH"
fi

if command -v sheldon &>/dev/null; then
  log_progress "Refreshing sheldon plugins"
  sheldon lock --reinstall || true
fi

summary_success "Zsh configured"
