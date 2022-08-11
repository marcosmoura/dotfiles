#!/usr/bin/env zsh

source ~/.zsh/utils.sh
source ~/.zsh/modules/git/scripts/utils.zsh
source ~/.zsh/modules/git/git.plugin.zsh

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

LOG_OUTPUT=`git log -n $LIMIT --abbrev-commit --color  --decorate --grep=$KEYWORD --pretty=format:"$FORMAT"`
format_log $LOG_OUTPUT

print_success "Done!"
