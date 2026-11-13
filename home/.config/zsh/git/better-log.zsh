#!/usr/bin/env zsh
# git l [git log args]: the last 25 commits as an aligned table

source ${0:A:h}/lib.zsh

format-log "$(git log -n 25 --date=human --abbrev-commit --color --pretty=format:"$GIT_LOG_FORMAT" "$@")"
