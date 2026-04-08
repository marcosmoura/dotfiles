#!/usr/bin/env bash
set -euo pipefail

if ! command -v log_step &>/dev/null; then
  source "${DOTFILES_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/installation/lib/utils.sh"
fi

log_step "Installing Node.js ecosystem"

dry_run_guard "Node.js" "Would install Node (mise), Bun, pnpm, global packages" && return 0

require_command mise || return 1
eval "$(mise activate bash)"

log_progress "Installing Node via mise"
mise install node@latest
mise use --global node@latest
mise use --global pnpm@latest

log_progress "Installing Bun via mise"
mise install bun@latest
mise use --global bun@latest

log_progress "Installing global packages"
while IFS= read -r pkg || [[ -n "$pkg" ]]; do
  [[ -z "$pkg" || "$pkg" == \#* ]] && continue
  pnpm add -g "$pkg" --dangerously-allow-all-builds || log_warn "Failed to install: $pkg"
done <"$DOTFILES_DIR/packages/node-globals.txt"

log_progress "Enabling corepack"
corepack enable
corepack prepare pnpm@latest --activate

summary_success "Node.js ecosystem installed"
