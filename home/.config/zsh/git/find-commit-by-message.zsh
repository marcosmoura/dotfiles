#!/usr/bin/env zsh
# git fm "<keyword>" [limit]: commits whose message contains the keyword

source ${0:A:h}/lib.zsh

keyword=$1 limit=${2:-50}

if [[ -z $keyword ]]; then
  print-error "No keyword provided."
  print-info "Usage: git fm \"<keyword>\""
  exit 1
fi

print-start "Searching the last $limit commits with the keyword '$keyword' \n"

log="$(git log -n "$limit" --date=human --abbrev-commit --color --decorate --grep="$keyword" --pretty=format:"$GIT_LOG_FORMAT")"

if [[ -z $log ]]; then
  print-info "No commits found with the keyword '$keyword'."
  exit 1
fi

format-log "$log"

print-success "Done!"
