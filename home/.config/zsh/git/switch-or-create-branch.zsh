#!/usr/bin/env zsh
# git go "<branch>": switch to the branch, creating it if it does not exist

source ${0:A:h}/lib.zsh

branch=$1

if [[ -z $branch ]]; then
  print-error "No branch name provided."
  print-info "Usage: git go \"<branch_name>\""
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$branch"; then
  git switch "$branch" 2>/dev/null
  print-success "Switched to branch '$branch'"
else
  git switch -c "$branch" 2>/dev/null
  echo ""
  print-start "A new branch called '$branch' was created!"
fi
