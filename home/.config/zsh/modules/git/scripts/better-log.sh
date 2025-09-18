#!/usr/bin/env bash

source ~/.config/zsh/utils.sh
source ~/.config/zsh/modules/git/scripts/utils.sh
source ~/.config/zsh/modules/git/git.plugin.sh

LOG_OUTPUT=$(git log -n 25 --date=human --abbrev-commit --color --pretty=format:"$GIT_LOG_FORMAT" $@)
format_log $LOG_OUTPUT
