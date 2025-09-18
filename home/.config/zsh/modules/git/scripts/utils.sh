#!/usr/bin/env bash

source ~/.config/zsh/utils.sh

LOG_SEPARATOR="^"
HASH="%C(yellow bold)%h"
AUTHOR="%<(20,trunc)%C(green bold)%aN"
DATE="%>>(18,trunc)%C(blue bold)%ad"
MESSAGE="%<(70,trunc)%C(reset)%s"
export GIT_LOG_FORMAT=$(join_by_char $LOG_SEPARATOR $HASH $AUTHOR $DATE $MESSAGE)

function format_log() {
  PRETTY_PRINT=$(tsv-pretty -x -l=25 -e -f -d=$LOG_SEPARATOR <<<$1)
  bat -p --color=always -l="gitlog" --pager="less -RFnXJ" <<<$PRETTY_PRINT
}
