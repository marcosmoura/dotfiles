#!/usr/bin/env zsh

source ~/.config/zsh/utils.sh

LOG_SEPARATOR="^"
HASH="%C(yellow bold)%h"
AUTHOR="%C(green bold)%aN"
DATE="%>>(14,trunc)%C(blue bold)%ad"
MESSAGE="%<(80,trunc)%C(reset)%s"
FORMAT=$(join_by_char $LOG_SEPARATOR $HASH $AUTHOR $DATE $MESSAGE)

function format_log() {
  PRETTY_PRINT=$(tsv-pretty -e -f -d=$LOG_SEPARATOR <<<$1)
  bat -p --color=always -l="Markdown" --pager="less -RFnXJ" <<<$PRETTY_PRINT
}
