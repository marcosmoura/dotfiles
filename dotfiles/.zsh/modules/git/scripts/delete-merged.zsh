#!/usr/bin/env zsh

source ~/.zsh/utils.sh
source ~/.zsh/modules/git/scripts/utils.zsh
source ~/.zsh/modules/git/git.plugin.zsh

print_start "Checking for branches that can be deleted \n"

git fetch -p
git fetch upstream -p

BRANCHES=`git branch -vv | awk "/: gone]/{print $1}"`

if [ -z "${BRANCHES}" ]; then
  print_info "No branches found"
  return 1
fi

print_progress "Deleting all merged branches \n"

$BRANCHES | xargs -n 1 git branch -D

print_success "Done!"
