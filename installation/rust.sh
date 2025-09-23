#!/usr/bin/env bash

print_start "Installing Rust"

if ! command -v rustup >/dev/null 2>&1 && ! command -v cargo >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env" 2>/dev/null || true
fi

print_progress "Installing Rust packages"

rust_bins=(
  binocular-cli
  cargo-cache
  cargo-machete
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
