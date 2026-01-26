#!/usr/bin/env bash

print_start "Installing Rust"

if ! command -v rustup >/dev/null 2>&1; then
  brew install rustup || true
fi

if ! rustup show active-toolchain >/dev/null 2>&1; then
  rustup toolchain install stable
  rustup default stable
fi

if [ -f "$HOME/.cargo/env" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env" 2>/dev/null || true
else
  export PATH="$HOME/.cargo/bin:$PATH"
fi

print_progress "Installing Rust packages"

rust_bins=(
  binocular-cli
  cargo-audit
  cargo-binstall
  cargo-cache
  cargo-machete
  cargo-sort
  cargo-update
  just
  powertest
)

for bin in "${rust_bins[@]}"; do
  if ! command -v "${bin%% *}" >/dev/null 2>&1; then
    cargo install "$bin" || true
  fi
done

print_success "Rust installed!"
