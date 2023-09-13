#!/usr/bin/env zsh

source ~/.config/zsh/utils.sh

# pnpm
export PNPM_HOME="/Users/marcosmoura/Library/pnpm"
case ":$PATH:" in
*":$PNPM_HOME:"*) ;;
*) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end

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
