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
