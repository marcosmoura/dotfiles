# History configuration
export HISTFILE="${ZDOTDIR:-$HOME}/.zsh_history"
export HISTSIZE=250000
export SAVEHIST=25000

setopt HIST_EXPIRE_DUPS_FIRST  # Expire duplicates first
setopt HIST_IGNORE_DUPS        # Don't record duplicates
setopt HIST_IGNORE_ALL_DUPS    # Delete old duplicate
setopt HIST_FIND_NO_DUPS       # Don't show duplicates in search
setopt HIST_IGNORE_SPACE       # Don't record commands starting with space
setopt HIST_SAVE_NO_DUPS       # Don't write duplicates
setopt SHARE_HISTORY           # Share history between sessions
