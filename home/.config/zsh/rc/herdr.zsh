# Give Herdr an event-driven title for commands that do not set their own title.
# Applications can replace this OSC title while they run; the prompt clears it.

autoload -Uz add-zsh-hook

function _herdr-autorename-refresh() {
  [[ ${HERDR_ENV:-} == 1 ]] || return
  "${HERDR_BIN_PATH:-herdr}" plugin action invoke marcosmoura.autorename.refresh >/dev/null 2>&1 &|
}

function _herdr-autorename-title() {
  [[ ${HERDR_ENV:-} == 1 ]] || return

  local -a words
  words=(${(z)1})
  local command=$words[1]
  [[ -n $command ]] || return
  command=${command:t}
  printf '\e]2;%s\a' "$command"
  _herdr-autorename-refresh
}

function _herdr-autorename-clear-title() {
  [[ ${HERDR_ENV:-} == 1 ]] || return
  printf '\e]2;\a'
  _herdr-autorename-refresh
}

add-zsh-hook preexec _herdr-autorename-title
add-zsh-hook precmd _herdr-autorename-clear-title
