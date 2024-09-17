#!/usr/bin/env zsh

source ~/.config/zsh/utils.sh

function updateRust {
  print_start "Updating Rust \n"

  rustup update
  rustup toolchain update stable
  cargo install-update --all

  print_success "Ruby updated! \n"
}
