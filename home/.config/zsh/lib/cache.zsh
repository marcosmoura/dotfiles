# Keep the code that tools generate for zsh on disk.
#
# starship, fzf, atuin and others print the zsh code that hooks them in.
# Asking costs a fork of 10 to 20 ms each on every shell start, and the answer
# only changes when the tool itself does.

ZSH_CACHE=${XDG_CACHE_HOME:-$HOME/.cache}/zsh
[[ -d $ZSH_CACHE ]] || mkdir -p $ZSH_CACHE

# cached <tool> <command> [args...]
#
# Sets REPLY to a file holding the output of the command. The command runs
# only when that file is missing or the tool's binary has changed since.
# Returns non-zero when the tool is not installed.
#
#   cached fzf fzf --zsh && source $REPLY
#
# The caller does the sourcing: sourced from in here, the top-level variables
# of the generated code would be local to this function.
cached() {
  # Find the tool by hand. Reading $commands would first build the table of
  # every command on PATH, which takes 4 ms and can wait until after the prompt.
  local dir bin
  for dir in $path; do
    [[ -f $dir/$1 && -x $dir/$1 ]] && bin=$dir/$1 && break
  done
  [[ -n $bin ]] || return

  # The first line of the file names the binary that wrote it. Homebrew keeps
  # every version in its own directory, so the resolved path changes on an
  # upgrade. -nt covers a binary that is replaced in place.
  local stamp
  bin=$bin:A
  REPLY=$ZSH_CACHE/$1.zsh
  [[ -r $REPLY ]] && IFS= read -r stamp <$REPLY
  [[ $stamp == "# $bin" && ! $bin -nt $REPLY ]] && return

  { print -r -- "# $bin" && "${@:2}"; } >|$REPLY.$$ && mv -f $REPLY.$$ $REPLY && zcompile $REPLY
}
