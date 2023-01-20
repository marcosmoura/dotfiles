#!/usr/bin/env zsh

source ~/.zsh/utils.sh
source ~/.zsh/modules/ruby/ruby.plugin.zsh
source ~/.zsh/modules/python/python.plugin.zsh
source ~/.zsh/modules/node/node.plugin.zsh
source ~/.zsh/modules/shell/shell.plugin.zsh
source ~/.zsh/modules/brew/brew.plugin.zsh

function updateAll {
  print_green "💻 Updating all tools \n"

  updateRuby
  updatePython
  updatePackages
  updateShell
  updateBrew
  reload

  print_success "Updated! \n"

  exec $SHELL -l
}

function updateMacos {
  print_text "Updating macOS \n"

  sudo softwareupdate -i -a
  mas upgrade

  print_success "macOS should be upgraded! \n"
}
