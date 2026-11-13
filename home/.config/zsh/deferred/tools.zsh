# Tool integrations. Loaded right after the first prompt.
#
# `cached` (lib/cache.zsh) keeps each tool's generated code on disk, so these
# lines cost a file read and not a fork.

# fzf: ctrl-t, alt-c and ** completion. It also takes ctrl-r, which atuin
# takes back below, so the order of these two matters.
cached fzf fzf --zsh && source $REPLY

# atuin: history search on ctrl-r. NOBIND keeps it off the up arrow.
export ATUIN_NOBIND=true
if cached atuin atuin init zsh; then
  source $REPLY
  bindkey '^R' atuin-search
fi

# zoxide: z and zi
cached zoxide zoxide init zsh && source $REPLY

# direnv: per-directory environment from .envrc
cached direnv direnv hook zsh && source $REPLY

# Lua module paths for luarocks. `luarocks path` takes 200 ms.
cached luarocks luarocks path --no-bin && source $REPLY

# mise: runtime versions per directory. Its activation code contains the
# current PATH, so it cannot be cached. VS Code's terminal gets the shims only.
#
# mise keeps its tools ahead of every directory that was on PATH when it was
# activated, and behind the ones added later. pnpm's and bun's own directories
# have to win over mise's pnpm and its bun shim, so they come off PATH for the
# activation and go back on in front.
typeset -gU path
path=(${path:#($PNPM_HOME|$BUN_INSTALL)/bin})
if (($+commands[mise])); then
  if [[ $TERM_PROGRAM == vscode ]]; then
    eval "$(mise activate zsh --shims)"
  else
    eval "$(mise activate zsh)"
  fi
fi
path=($PNPM_HOME/bin(N-/) $BUN_INSTALL/bin(N-/) $path)

# macOS provides an ssh-agent through launchd. This is for sessions without one.
if [[ -z ${SSH_AUTH_SOCK:-} ]] && (($+commands[ssh - agent])) && ! pgrep -u $USER ssh-agent >/dev/null 2>&1; then
  eval "$(ssh-agent -s)"
fi
