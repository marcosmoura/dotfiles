#!/usr/bin/env bash
set -euo pipefail

if ! command -v log_step &>/dev/null; then
  source "${DOTFILES_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/installation/lib/utils.sh"
fi

log_step "Installing Node.js ecosystem"

dry_run_guard "Node.js" "Would install global packages via pnpm" && return 0

require_command node || return 1
require_command pnpm || return 1

packages_file="$DOTFILES_DIR/packages/node-globals.txt"

if [[ ! -f "$packages_file" ]]; then
  log_error "Node globals file not found: $packages_file"
  summary_fail "Node.js ecosystem"
  return 1
fi

log_progress "Installing global packages"
while IFS= read -r pkg || [[ -n "$pkg" ]]; do
  [[ -z "$pkg" || "$pkg" == \#* ]] && continue
  pnpm add -g "$pkg" || log_warn "Failed to install: $pkg"
done <"$packages_file"

summary_success "Node.js ecosystem installed"
