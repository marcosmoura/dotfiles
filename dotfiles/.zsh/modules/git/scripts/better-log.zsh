#!/usr/bin/env zsh

source ~/.zsh/utils.sh
source ~/.zsh/modules/git/scripts/utils.zsh
source ~/.zsh/modules/git/git.plugin.zsh

LIMIT=$1

if [ -z "${LIMIT}" ]; then
  LIMIT=25
fi

LOG_OUTPUT=`git log -n $LIMIT --abbrev-commit --color --pretty=format:"$FORMAT"`
format_log $LOG_OUTPUT
