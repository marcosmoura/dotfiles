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
  npm update -g

  print_progress "Updating PNPM \n"

  pnpm store prune
  pnpm update -g

  print_success "Packages updated! \n"
}

function nodeVersions {
  echo "node: $(node -v)"
  echo "npm: $(npm -v)"
  echo "yarn: $(yarn -v)"
  echo "pnpm: $(pnpm -v)"
  echo "bun: $(bun -v)"
  echo "Typescript: $(tsc -v | sed 's/Version //')"
  echo "Nx: $(nx --version | grep Global | sed 's/- Global: v//')"

  print_success "Node ENV versions"
}
