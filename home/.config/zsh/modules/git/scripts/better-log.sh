#!/bin/bash

source ~/.config/zsh/utils.sh
source ~/.config/zsh/modules/git/scripts/utils.zsh
source ~/.config/zsh/modules/git/git.plugin.zsh

LOG_OUTPUT=$(git log -n 25 --date=human --abbrev-commit --color --pretty=format:"$GIT_LOG_FORMAT" $@)
format_log $LOG_OUTPUT
