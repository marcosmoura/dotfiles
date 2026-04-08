#!/usr/bin/env bash
set -euo pipefail

# Ensure utils are loaded
if ! command -v log_step &>/dev/null; then
  source "${DOTFILES_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/installation/lib/utils.sh"
fi

log_step "Configuring zsh"

dry_run_guard "Zsh" "Would add zsh to /etc/shells, set as default shell, install zplug plugins" && return 0

ZSH_PATH="$(command -v zsh)"

if ! grep -Fxq "$ZSH_PATH" /etc/shells; then
  log_progress "Adding zsh to /etc/shells"
  echo "$ZSH_PATH" | sudo tee -a /etc/shells >/dev/null
fi

if [ "$SHELL" != "$ZSH_PATH" ]; then
  log_progress "Setting zsh as default shell"
  chsh -s "$ZSH_PATH"
fi

if command -v zplug &>/dev/null; then
  log_progress "Installing zplug plugins"
  # zplug install is handled automatically on first shell start
  # but we can force it here if needed
  export ZPLUG_HOME="$(brew --prefix)/opt/zplug"
  source "$ZPLUG_HOME/init.zsh"
  zplug check || zplug install
fi

summary_success "Zsh configured"
