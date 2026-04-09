#!/usr/bin/env bash
set -euo pipefail

if ! command -v log_step &>/dev/null; then
  source "${DOTFILES_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/installation/lib/utils.sh"
fi

log_step "Installing Lua packages"

require_command luarocks || return 1

log_progress "Installing luarocks packages"
while IFS= read -r pkg <&3 || [[ -n "$pkg" ]]; do
  [[ -z "$pkg" || "$pkg" == \#* ]] && continue
  if ! luarocks list --porcelain | grep -q "$pkg"; then
    luarocks install "$pkg" || log_warn "Failed to install: $pkg"
  fi
done 3<"$DOTFILES_DIR/packages/luarocks.txt"

summary_success "Lua packages installed"
