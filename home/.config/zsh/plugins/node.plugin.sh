#!/usr/bin/env bash

source ~/.config/zsh/utils.sh

# pnpm
export PNPM_HOME="$HOME/Library/pnpm"
case ":$PATH:" in
*":$PNPM_HOME:"*) ;;
*) export PATH="$PNPM_HOME:$PATH" ;;
esac

function print_version {
  local name=$1
  local version=$2

  printf "$TEXT_YELLOW%s: $TEXT_RESET%s\n" "$name" "$version"
}

function print_installed_version {
  local name=$1
  shift

  if command -v "$name" >/dev/null 2>&1; then
    print_version "$name" "$("$@")"
  fi
}

function nodeVersions {
  print_info "Node ENV versions:\n"

  print_installed_version node node -v
  print_installed_version npm npm -v
  print_installed_version yarn yarn -v
  print_installed_version pnpm pnpm -v

  if command -v tsc >/dev/null 2>&1; then
    print_version "tsc" "$(tsc -v | sed 's/Version //')"
  fi

  if command -v nx >/dev/null 2>&1; then
    local nx_version_output
    local nx_global_version
    local nx_local_version

    nx_version_output="$(nx --version 2>/dev/null)"
    nx_global_version="$(printf '%s\n' "$nx_version_output" | grep Global | sed 's/- Global: v//')"
    nx_local_version="$(printf '%s\n' "$nx_version_output" | grep Local | sed 's/- Local: v//')"

    if [[ $nx_global_version == *"Not found"* ]]; then
      print_version "nx" "$nx_local_version (using local version)"
    else
      print_version "nx" "$nx_global_version (using global version)"
    fi
  fi
}
