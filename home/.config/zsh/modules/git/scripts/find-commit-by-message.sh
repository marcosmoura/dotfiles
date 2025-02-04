#!/bin/bash

source ~/.config/zsh/utils.sh
source ~/.config/zsh/modules/git/scripts/utils.zsh
source ~/.config/zsh/modules/git/git.plugin.zsh

KEYWORD=$1
LIMIT=$2

if [ -z "${KEYWORD}" ]; then
  print_error "No keyword provided."
  print_info "Usage: git fm \"<keyword>\""
  return 1
fi

if [ -z "${LIMIT}" ]; then
  LIMIT=50
fi

print_start "Searching the last $LIMIT commits with the keyword '$KEYWORD' \n"

LOG_OUTPUT=$(git log -n $LIMIT --date=human --abbrev-commit --color --decorate --grep=$KEYWORD --pretty=format:"$FORMAT")

if [ -z "${LOG_OUTPUT}" ]; then
  print_info "No commits found with the keyword '$KEYWORD'."
  return 1
fi

format_log $LOG_OUTPUT

print_success "Done!"
