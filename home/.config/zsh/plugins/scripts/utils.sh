#!/usr/bin/env bash

source ~/.config/zsh/utils.sh

LOG_SEPARATOR="^"
HASH="%C(yellow bold)%h"
AUTHOR="%<(20,trunc)%C(green bold)%aN"
DATE="%>>(18,trunc)%C(blue bold)%ad"
MESSAGE="%<(70,trunc)%C(reset)%s"

join_by_char() {
  local d=${1-} f=${2-}
  if shift 2; then
    printf %s "$f" "${@/#/$d}"
  fi
}

export GIT_LOG_FORMAT=$(join_by_char $LOG_SEPARATOR $HASH $AUTHOR $DATE $MESSAGE)

function format_log() {
  local pretty_print="$1"

  if command -v tsv-pretty >/dev/null 2>&1; then
    pretty_print="$(tsv-pretty -x -l=25 -e -f -d="$LOG_SEPARATOR" <<<"$1")"
  fi

  if command -v bat >/dev/null 2>&1; then
    bat -p --color=always -l="gitlog" --pager="less -RFnXJ" <<<"$pretty_print"
  else
    printf '%s\n' "$pretty_print"
  fi
}
