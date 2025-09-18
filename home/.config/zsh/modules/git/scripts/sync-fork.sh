#!/usr/bin/env bash

source ~/.config/zsh/utils.sh
source ~/.config/zsh/modules/git/scripts/utils.sh
source ~/.config/zsh/modules/git/git.plugin.sh

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
TARGET_BRANCH=$1

if [ -z "${1}" ]; then
  TARGET_BRANCH=$CURRENT_BRANCH
fi

if [ -z "${TARGET_BRANCH}" ]; then
  print_error "No branch name was found."
  print_info "Usage: git sync <target-branch>"
  return 1
fi

print_start "Syncing fork on $TARGET_BRANCH branch \n"

git fetch upstream -p
git checkout $TARGET_BRANCH 2>/dev/null
git rebase upstream/$TARGET_BRANCH $TARGET_BRANCH
git po

print_success "$TARGET_BRANCH branch updated!"
