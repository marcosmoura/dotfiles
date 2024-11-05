print_start "Installing latest stable Rust"

rustup toolchain install stable
cargo install cargo-update

print_success "Rust installed! \n"
