#!/usr/bin/env bash

# Ensure utils available when running standalone
if ! command -v print_start >/dev/null 2>&1; then
  # shellcheck disable=SC1091
  source home/.config/zsh/utils.sh
fi

authenticateBeforeUpdate
