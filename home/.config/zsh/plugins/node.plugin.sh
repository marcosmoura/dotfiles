#!/usr/bin/env bash

source ~/.config/zsh/utils.sh

# pnpm
export PNPM_HOME="$HOME/Library/pnpm"
case ":$PATH:" in
*":$PNPM_HOME:"*) ;;
*) export PATH="$PNPM_HOME:$PATH" ;;
esac

# Mise
if [[ "$TERM_PROGRAM" == "vscode" ]]; then
  eval "$(mise activate zsh --shims)"
else
  eval "$(mise activate zsh)"
fi

function print_version {
  local name=$1
  local version=$2

  printf "$TEXT_YELLOW%s: $TEXT_RESET%s\n" "$name" "$version"
}

function nodeVersions {
  local NX_GLOBAL_VERSION="$(nx --version | grep Global | sed 's/- Global: v//')"
  local NX_LOCAL_VERSION="$(nx --version | grep Local | sed 's/- Local: v//')"

  print_info "Node ENV versions:\n"

  print_version "node" "$(node -v)"
  print_version "npm" "$(npm -v)"
  print_version "yarn" "$(yarn -v)"
  print_version "pnpm" "$(pnpm -v)"
  print_version "bun" "$(bun -v)"
  print_version "tsc" "$(tsc -v | sed 's/Version //')"

  # In case nx global is "Not found", print the local version
  if [[ $NX_GLOBAL_VERSION == *"Not found"* ]]; then
    print_version "nx" "$NX_LOCAL_VERSION (using local version)"
  else
    print_version "nx" "$NX_GLOBAL_VERSION (using global version)"
  fi
}
