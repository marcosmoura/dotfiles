#!/usr/bin/env zsh

source ~/.zsh/utils.sh
source ~/.zsh/modules/git/scripts/utils.zsh
source ~/.zsh/modules/git/git.plugin.zsh

LOG_OUTPUT=`git log -n 25 --abbrev-commit --color --pretty=format:"$FORMAT" $@`
format_log $LOG_OUTPUT
