#!/usr/bin/env zsh

source ~/.zsh/utils.sh


function updateBrew {
  print_start "Updating Homebrew \n"

  brew update
  brew upgrade
  brew cleanup
  brew doctor

  print_success "Homebrew updated! \n"
}
