print_start "Installing Rust"

if ! brew ls --versions rust >/dev/null; then
  brew install rust
  brew install rustup-init
fi

print_progress "Installing Rust packages"

cargo install binocular-cli

print_success "Rust installed! \n"
