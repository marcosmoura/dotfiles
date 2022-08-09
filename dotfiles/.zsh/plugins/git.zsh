#!/usr/bin/env zsh

source ~/.zsh/utils.sh

# Simple git
alias g='git'

# Go to git root
alias groot='cd `git rev-parse --show-toplevel`'

function rebaseFork() {
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  TARGET_BRANCH=$1

  if [ -z "${1}" ]; then
    TARGET_BRANCH=$CURRENT_BRANCH
  fi

  if [ -z "${TARGET_BRANCH}" ]; then
    print_error "No branch name was found."
    print_info "Usage: rebaseFork <target-branch>"
    return 1
  fi

  print_start "Rebasing fork on $TARGET_BRANCH branch \n"

  g fetch upstream -p;
  g rebase upstream/$TARGET_BRANCH $TARGET_BRANCH;
  g po

  print_success "$TARGET_BRANCH branch updated!"
}
