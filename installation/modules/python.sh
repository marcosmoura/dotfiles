#!/usr/bin/env bash
set -euo pipefail

if ! command -v log_step &>/dev/null; then
  source "${DOTFILES_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/installation/lib/utils.sh"
fi

log_step "Installing Python ecosystem"

dry_run_guard "Python" "Would install Python (mise), create venv" && return 0

require_command mise || return 1
eval "$(mise activate bash)"

log_progress "Installing Python via mise"
mise install python@latest
mise use --global python@latest
# Refresh PATH so python/pip resolve to the mise-managed version
eval "$(mise env)"

require_command uv || return 1

VENV_DIR="$HOME/.local/share/venv"
if [ ! -d "$VENV_DIR" ]; then
  log_progress "Creating global virtual environment"
  uv venv "$VENV_DIR"
fi

summary_success "Python ecosystem installed"
