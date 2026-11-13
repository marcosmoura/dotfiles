#!/usr/bin/env zsh
# git sync-fork [branch]: rebase the branch (default: the current one) on upstream and push it

source ${0:A:h}/lib.zsh

branch=${1:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null)}

if [[ -z $branch ]]; then
  print-error "No branch name was found."
  print-info "Usage: git sync <target-branch>"
  exit 1
fi

print-start "Syncing fork on $branch branch \n"

git fetch upstream -p
git switch "$branch" 2>/dev/null
git rebase "upstream/$branch" "$branch"
git po

print-success "$branch branch updated!"
