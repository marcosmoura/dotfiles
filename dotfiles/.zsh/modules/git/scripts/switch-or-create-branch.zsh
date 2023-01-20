#!/usr/bin/env zsh

source ~/.zsh/utils.sh
source ~/.zsh/modules/git/scripts/utils.zsh

BRANCH_NAME=$1

if [ -z "${BRANCH_NAME}" ]; then
  print_error "No branch name provided."
  print_info "Usage: git go \"<branch_name>\""
  return 1
fi

EXISTS=`git show-ref refs/heads/$BRANCH_NAME`

if [ -n "$EXISTS" ]; then
  git checkout $BRANCH_NAME 2> /dev/null
  print_success "Switched to branch '$BRANCH_NAME'"
else
  git checkout -b $BRANCH_NAME 2> /dev/null
  echo ""
  print_start "A new branch called '$BRANCH_NAME' was created!"
fi
