#!/usr/bin/env bash

source ~/.config/zsh/utils.sh

# pnpm
export PNPM_HOME="$HOME/Library/pnpm"
case ":$PATH:" in
*":$PNPM_HOME:"*) ;;
*) export PATH="$PNPM_HOME:$PATH" ;;
esac

# Mise
if command -v mise >/dev/null 2>&1; then
  if [[ "$TERM_PROGRAM" == "vscode" ]]; then
    eval "$(mise activate zsh --shims)"
  else
    eval "$(mise activate zsh)"
  fi
fi

function print_version {
  local name=$1
  local version=$2

  printf "$TEXT_YELLOW%s: $TEXT_RESET%s\n" "$name" "$version"
}

function print_installed_version {
  local name=$1
  local version
  shift

  if command -v "$name" >/dev/null 2>&1; then
    version="$("$@")"
    print_version "$name" "$version"
  fi
}

function nodeVersions {
  print_info "Node ENV versions:\n"

  print_installed_version node node -v
  print_installed_version npm npm -v
  print_installed_version yarn yarn -v
  print_installed_version pnpm pnpm -v
  print_installed_version bun bun -v

  if command -v tsc >/dev/null 2>&1; then
    print_version "tsc" "$(tsc -v | sed 's/Version //')"
  fi
}
