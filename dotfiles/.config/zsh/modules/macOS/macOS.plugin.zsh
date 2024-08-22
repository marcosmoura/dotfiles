#!/usr/bin/env zsh

source ~/.config/zsh/utils.sh
source ~/.config/zsh/modules/ruby/ruby.plugin.zsh
source ~/.config/zsh/modules/python/python.plugin.zsh
source ~/.config/zsh/modules/node/node.plugin.zsh
source ~/.config/zsh/modules/shell/shell.plugin.zsh
source ~/.config/zsh/modules/brew/brew.plugin.zsh

function updateAll {
  print_green "💻 Updating all tools \n"

  updateRuby
  updatePython
  updateBrew
  updatePackages
  updateShell

  print_success "Updated! \n"

  exec $SHELL -l
}

function updateMacos {
  print_text "Updating macOS \n"

  sudo softwareupdate -i -a
  mas upgrade

  print_success "macOS should be upgraded! \n"
}

function systeminfo {
  print_yellow "\n  💻  Apple MacBook Pro 16\" / M1 Max / 64GB / 1TB"
  macchina
}
