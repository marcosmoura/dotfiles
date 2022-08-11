#!/usr/bin/env zsh

source ~/.zsh/utils.sh


function updatePackages {
  print_start "Updating Packages \n"

  print_progress "Updating NPM"

  sudo npm cache clean -f
  npm install npm -g
  npm update -g


  print_progress "Updating Yarn \n"

  yarn cache clean --force
  yarn global upgrade --latest


  print_success "Packages updated! \n"
}
