#!/usr/bin/env bash
set -euo pipefail

if ! command -v log_step &>/dev/null; then
  source "${DOTFILES_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/installation/lib/utils.sh"
fi

log_step "Installing Rust ecosystem"

require_command rustup || return 1

rustup toolchain install stable
rustup default stable

# Add cargo to PATH — brew-installed rustup doesn't create ~/.cargo/env,
# so resolve the toolchain bin directory via rustup itself.
CARGO_BIN_DIR="$(dirname "$(rustup which cargo)")"
export PATH="$CARGO_BIN_DIR:$HOME/.cargo/bin:$PATH"

log_progress "Installing cargo binaries"
while IFS= read -r bin <&3 || [[ -n "$bin" ]]; do
  [[ -z "$bin" || "$bin" == \#* ]] && continue
  if ! cargo install --list 2>/dev/null | grep -q "^$bin "; then
    log_progress "Installing $bin"
    retry 2 5 cargo install "$bin" || log_warn "Failed to install: $bin"
  fi
done 3<"$DOTFILES_DIR/packages/cargo-binaries.txt"

summary_success "Rust ecosystem installed"
