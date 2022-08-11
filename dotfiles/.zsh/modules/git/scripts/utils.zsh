#!/usr/bin/env zsh

source ~/.zsh/utils.sh

LOG_SEPARATOR="^"
HASH="%C(yellow bold)%h"
AUTHOR="%<(19,trunc)%C(green bold)%aN"
DATE="%>|(45,trunc)%C(blue bold)%ad"
MESSAGE="%<|(130,trunc)%C(reset)%s"
FORMAT=$(join_by_char $LOG_SEPARATOR $HASH $AUTHOR $DATE $MESSAGE)

function format_log() {
  TEMP_FILE=$(mktemp)
  echo "$1" > $TEMP_FILE
  FILE_TO_COLUMNS=`tsv-pretty -e -f -d=$LOG_SEPARATOR $TEMP_FILE`
  bat -p --color=always -l="Markdown" --pager="less -RFnXJ" --theme="Sublime Snazzy" <<< $FILE_TO_COLUMNS
  rm $TEMP_FILE
}
