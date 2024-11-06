#!/usr/bin/env zsh

source ~/.config/zsh/utils.sh

function updateAll {
  print_green "💻 Updating all tools \n"

  authenticateBeforeUpdate
  topgrade

  print_success "Updated! \n"

  reload
}

function systeminfo {
  print_yellow "\n  💻  Apple MacBook Pro 16\" / M1 Max / 64GB / 1TB\n"
  fastfetch
}
