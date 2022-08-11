#!/usr/bin/env zsh

source ~/.zsh/utils.sh

function updateAll {
  print_green "💻 Updating everything"

  updateRuby
  updatePackages
  updateZsh
  updateBrew
  reload

  print_success "Updated! \n"
}

function updateMacos {
  print_text "Updating macOS \n"

  sudo softwareupdate -i -a
  mas upgrade

  print_success "macOS should be upgraded! \n"
}
