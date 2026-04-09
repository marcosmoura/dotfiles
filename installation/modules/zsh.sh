#!/usr/bin/env bash
set -euo pipefail

# Ensure utils are loaded
if ! command -v log_step &>/dev/null; then
  source "${DOTFILES_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/installation/lib/utils.sh"
fi

log_step "Configuring zsh"

if dry_run_guard "Zsh" "Would add zsh to /etc/shells, set as default shell, install zap plugins"; then return 0; fi

ZSH_PATH="$(command -v zsh)"

if ! grep -Fxq "$ZSH_PATH" /etc/shells; then
  log_progress "Adding zsh to /etc/shells"
  echo "$ZSH_PATH" | sudo tee -a /etc/shells >/dev/null
fi

if [ "$SHELL" != "$ZSH_PATH" ]; then
  log_progress "Setting zsh as default shell"
  chsh -s "$ZSH_PATH"
fi

ZAP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/zap"
if [ ! -d "$ZAP_DIR" ]; then
  log_progress "Installing zap plugin manager"
  zsh <(curl -s https://raw.githubusercontent.com/zap-zsh/zap/master/install.zsh) --branch release-v1 --keep
fi

summary_success "Zsh configured"
