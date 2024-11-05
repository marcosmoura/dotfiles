#!/usr/bin/env zsh

source ~/.config/zsh/utils.sh

# bun completions
[ -s "$HOME/.bun/_bun" ] && source "$HOME/.bun/_bun"

# bun
export BUN_INSTALL="$HOME/.bun"
add_to_path $BUN_INSTALL/bin

# pnpm
export PNPM_HOME="$HOME/.local/share/pnpm"
add_to_path $PNPM_HOME

export PATH=$(flatten_path)

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
