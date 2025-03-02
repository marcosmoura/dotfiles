#!/bin/bash

source ~/.config/zsh/utils.sh

function updateSystem {
  print_green "💻 Updating system tools\n"

  authenticateBeforeUpdate
  topgrade
  fsh-alias $XDG_CONFIG_HOME/syntax-theme/syntax-theme.ini >/dev/null 2>&1

  print_success "Updated! \n"
}

function systeminfo {
  print_yellow "\n  💻 Apple MacBook Pro 16\" / M1 Max / 64GB / 1TB\n"
  fastfetch
}
