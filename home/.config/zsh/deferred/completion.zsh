# The completion system. Loaded right after the first prompt: nothing needs it
# before the first tab.

# Completions that load themselves on first use. See the files in there.
fpath=($ZSH_DIR/completions $fpath)

# `compinit -C` trusts its dump file and skips scanning every directory in
# fpath. Scan again once the dump is 20 hours old, so that completions
# installed since then (by Homebrew, mostly) show up within a day, and at once
# when a file is added to or removed from ../completions.
autoload -Uz compinit
() {
  local dump=$ZSH_CACHE/zcompdump
  local -a fresh=($dump(N.mh-20))

  if (($#fresh)) && [[ ! $ZSH_DIR/completions -nt $dump ]]; then
    compinit -C -d $dump
  else
    # compinit rewrites a dump only when the number of completion files has
    # changed, which would leave an old one old forever.
    rm -f $dump
    # -i: skip insecure directories without asking. A question here would
    # never be seen, because deferred code runs with its output discarded.
    compinit -i -d $dump
    zcompile $dump
  fi
}

# Homebrew's git puts its own _git ahead of zsh's on fpath. That one knows
# neither the user-commands style nor the _git-* functions below, so take
# zsh's, by its path.
() {
  local -a own=(${^fpath}/_git(N))
  own=(${(M)own:#*/zsh/$ZSH_VERSION/functions/_git})
  # Without the unfunction, zsh keeps loading the file it registered first
  (($#own)) && unfunction _git 2>/dev/null && autoload -Uz $own[1]
}

# Descriptions for the custom git commands defined in ~/.config/git/config.
# They complete like the git command each one wraps.
zstyle ':completion:*:*:git:*' user-commands \
  go:'switch to a branch or create a new one' \
  sync-fork:'sync forked repo with upstream' \
  l:'short log' \
  fm:'find commits by message' \
  fc:'find commits by path' \
  give-credit:'give author credits to a commit' \
  delete-merged:'delete merged branches'

_git-go() { _git-branch; }
_git-sync-fork() { _git-branch; }
_git-delete-merged() { _git-branch; }
_git-l() { _git-log; }
_git-fm() { _git-log; }
_git-fc() { _git-log; }
_git-give-credit() { _git-commit; }
