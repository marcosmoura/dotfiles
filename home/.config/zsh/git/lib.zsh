# Shared by the scripts in this directory. Each one backs a custom git command
# from ~/.config/git/config, and git runs it as `zsh <script> <args>`.

source ${0:A:h}/../lib/print.zsh

# One commit per line, the columns separated by ^ for tsv-pretty to align
typeset -a _log_columns=(
  '%C(yellow bold)%h'             # hash
  '%<(20,trunc)%C(green bold)%aN' # author
  '%>>(18,trunc)%C(blue bold)%ad' # date
  '%<(70,trunc)%C(reset)%s'       # subject
)
GIT_LOG_FORMAT=${(j:^:)_log_columns}

# format-log <git log output>: align the columns and page the result
format-log() {
  local table="$(tsv-pretty -x -l=25 -e -f -d='^' <<<$1)"
  bat -p --color=always -l=gitlog --pager="less -RFnXJ" <<<$table
}
