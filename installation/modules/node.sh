#!/usr/bin/env bash
set -euo pipefail

if ! command -v log_step &>/dev/null; then
  source "${DOTFILES_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/installation/lib/utils.sh"
fi

log_step "Installing Node.js ecosystem"

if dry_run_guard "Node.js" "Would install Node (mise), pnpm, global packages"; then return 0; fi

require_command mise || return 1
eval "$(mise activate bash)"

log_progress "Installing Node via mise"
mise install node@latest
mise use --global node@latest
mise use --global pnpm@latest

# Refresh PATH so node/pnpm resolve to the mise-managed versions
eval "$(mise env)"

# Ensure pnpm global bin directory exists
export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
mkdir -p "$PNPM_HOME"
export PATH="$PNPM_HOME:$PATH"
pnpm setup || true

log_progress "Installing global packages"
while IFS= read -r pkg <&3 || [[ -n "$pkg" ]]; do
  [[ -z "$pkg" || "$pkg" == \#* ]] && continue
  pnpm add -g "$pkg" --dangerously-allow-all-builds || log_warn "Failed to install: $pkg"
done 3<"$DOTFILES_DIR/packages/node-globals.txt"

log_progress "Enabling corepack"
corepack enable
corepack prepare pnpm@latest --activate

summary_success "Node.js ecosystem installed"
