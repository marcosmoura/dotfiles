#!/usr/bin/env zsh
# git fc "<path>" [limit]: commits whose diff adds or removes the string

source ${0:A:h}/lib.zsh

search=$1 limit=${2:-50}

if [[ -z $search ]]; then
  print-error "No path provided."
  print-info "Usage: git fc \"<path>\""
  exit 1
fi

print-start "Searching the last $limit commits that affected the \"$search\" path \n"

log="$(git log -n "$limit" --date=human --abbrev-commit --color --decorate --pretty=format:"$GIT_LOG_FORMAT" -S"$search")"

if [[ -z $log ]]; then
  print-info "No commits found for the '$search' path."
  exit 1
fi

format-log "$log"

print-success "Done!"
