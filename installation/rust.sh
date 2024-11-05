print_start "Installing latest stable Rust"

rustup toolchain install stable
cargo install cargo-update
cargo install cargo-cache

print_success "Rust installed! \n"
