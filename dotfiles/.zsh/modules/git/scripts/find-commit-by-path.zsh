#!/usr/bin/env zsh

source ~/.zsh/utils.sh
source ~/.zsh/modules/git/scripts/utils.zsh
source ~/.zsh/modules/git/git.plugin.zsh

SEARCH_PATH=$1
LIMIT=$2

if [ -z "${SEARCH_PATH}" ]; then
  print_error "No path provided."
  print_info "Usage: git fc \"<path>\""
  return 1
fi

if [ -z "${LIMIT}" ]; then
  LIMIT=50
fi

print_start "Searching the last $LIMIT commits that affected the \"$SEARCH_PATH\" path \n"

LOG_OUTPUT=`git log -n $LIMIT --abbrev-commit --color  --decorate --pretty=format:"$FORMAT" -S$SEARCH_PATH;`

if [ -z "${LOG_OUTPUT}" ]; then
  print_info "No commits found for the '$SEARCH_PATH' path."
  return 1
fi

format_log $LOG_OUTPUT

print_success "Done!"
