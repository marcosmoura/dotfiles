# History

export HISTFILE="${ZDOTDIR:-$HOME}/.zsh_history"
HISTSIZE=250000
SAVEHIST=25000

setopt EXTENDED_HISTORY       # Record the time and duration of each command
setopt HIST_EXPIRE_DUPS_FIRST # Expire duplicates first
setopt HIST_IGNORE_DUPS       # Don't record duplicates
setopt HIST_IGNORE_ALL_DUPS   # Delete old duplicate
setopt HIST_FIND_NO_DUPS      # Don't show duplicates in search
setopt HIST_IGNORE_SPACE      # Don't record commands starting with space
setopt HIST_SAVE_NO_DUPS      # Don't write duplicates
setopt HIST_VERIFY            # Show a history expansion before running it
setopt SHARE_HISTORY          # Share history between sessions

# The builtin lists only the last 16 entries. List them all unless told otherwise.
history() { builtin fc -l ${@:-1}; }
