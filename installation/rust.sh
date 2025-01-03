print_start "Installing Rust"

if ! brew ls --versions rust >/dev/null; then
  brew install rust
  brew install rustup-init
  rustup toolchain install stable
fi

print_progress "Installing Rust packages"

cargo install binocular-cli
cargo install cargo-update
cargo install cargo-cache

print_success "Rust installed! \n"
