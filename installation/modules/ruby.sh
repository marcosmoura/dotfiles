#!/usr/bin/env bash
set -euo pipefail

if ! command -v log_step &>/dev/null; then
  source "${DOTFILES_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/installation/lib/utils.sh"
fi

log_step "Installing Ruby ecosystem"

if dry_run_guard "Ruby" "Would install Ruby (mise), install gems from packages/gems.txt"; then return 0; fi

require_command mise || return 1
eval "$(mise activate bash)"

log_progress "Installing Ruby via mise"
mise install ruby@latest
mise use --global ruby@latest
# Refresh PATH so gem/ruby resolve to the mise-managed version
eval "$(mise env)"

log_progress "Installing gems"
while IFS= read -r gem <&3 || [[ -n "$gem" ]]; do
  [[ -z "$gem" || "$gem" == \#* ]] && continue
  if ! gem list -i "$gem" &>/dev/null; then
    gem install "$gem" || log_warn "Failed to install: $gem"
  fi
done 3<"$DOTFILES_DIR/packages/gems.txt"

summary_success "Ruby ecosystem installed"
