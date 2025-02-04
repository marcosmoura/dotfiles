#!/bin/bash

source ~/.config/zsh/utils.sh

# pnpm
export PNPM_HOME="/Users/marcosmoura/Library/pnpm"
case ":$PATH:" in
*":$PNPM_HOME:"*) ;;
*) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end

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
