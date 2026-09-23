# Give Herdr an event-driven title for commands that do not set their own title.
# Applications can replace this OSC title while they run; the prompt clears it.

autoload -Uz add-zsh-hook

function _herdr_autorename_refresh() {
  [[ ${HERDR_ENV:-} == 1 ]] || return
  "${HERDR_BIN_PATH:-herdr}" plugin action invoke marcosmoura.autorename.refresh >/dev/null 2>&1 &!
}

function _herdr_autorename_title() {
  [[ ${HERDR_ENV:-} == 1 ]] || return

  local -a words
  words=(${(z)1})
  local command=$words[1]
  [[ -n $command ]] || return
  command=${command:t}
  printf '\e]2;%s\a' "$command"
  _herdr_autorename_refresh
}

function _herdr_autorename_clear_title() {
  [[ ${HERDR_ENV:-} == 1 ]] || return
  printf '\e]2;\a'
  _herdr_autorename_refresh
}

add-zsh-hook preexec _herdr_autorename_title
add-zsh-hook precmd _herdr_autorename_clear_title
