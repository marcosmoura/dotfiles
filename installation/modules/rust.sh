#!/usr/bin/env bash
set -euo pipefail

if ! command -v log_step &>/dev/null; then
  source "${DOTFILES_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/installation/lib/utils.sh"
fi

log_step "Installing Rust ecosystem"

if dry_run_guard "Rust" "Would install Rust toolchain (rustup), install cargo binaries"; then return 0; fi

require_command rustup || return 1

rustup toolchain install stable
rustup default stable

if [ -f "$HOME/.cargo/env" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env" 2>/dev/null || true
else
  export PATH="$HOME/.cargo/bin:$PATH"
fi

log_progress "Installing cargo binaries"
while IFS= read -r bin || [[ -n "$bin" ]]; do
  [[ -z "$bin" || "$bin" == \#* ]] && continue
  if ! cargo install --list 2>/dev/null | grep -q "^$bin "; then
    log_progress "Installing $bin"
    retry 2 5 cargo install "$bin" || log_warn "Failed to install: $bin"
  fi
done <"$DOTFILES_DIR/packages/cargo-binaries.txt"

summary_success "Rust ecosystem installed"
