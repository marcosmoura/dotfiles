#!/bin/bash

print_start "Installing Rust"

if ! brew ls --versions rust >/dev/null; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
fi

print_progress "Installing Rust packages"

cargo install binocular-cli
cargo install cargo-update
cargo install cargo-cache

print_success "Rust installed! \n"
