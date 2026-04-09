#!/usr/bin/env bash
set -euo pipefail

if ! command -v log_step &>/dev/null; then
  source "${DOTFILES_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/installation/lib/utils.sh"
fi

log_step "Installing Python ecosystem"

if dry_run_guard "Python" "Would install Python (mise), create venv, install pip packages"; then return 0; fi

require_command mise || return 1
eval "$(mise activate bash)"

log_progress "Installing Python via mise"
mise install python@latest
mise use --global python@latest

require_command uv || return 1

VENV_DIR="$HOME/.local/share/venv"
if [ ! -d "$VENV_DIR" ]; then
  log_progress "Creating global virtual environment"
  uv venv "$VENV_DIR"
fi

log_progress "Installing pip packages"
while IFS= read -r pkg || [[ -n "$pkg" ]]; do
  [[ -z "$pkg" || "$pkg" == \#* ]] && continue
  uv pip install --python "$VENV_DIR/bin/python" --upgrade "$pkg" || log_warn "Failed to install: $pkg"
done <"$DOTFILES_DIR/packages/pip-packages.txt"

summary_success "Python ecosystem installed"
