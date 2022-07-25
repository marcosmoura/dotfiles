# Path
export PATH=/usr/local/bin:$PATH
export PATH=$HOME/.rbenv/shims:$PATH
export PATH=$HOME/.yarn/bin:$PATH
export PATH=$HOME/.config/yarn/global/node_modules/.bin:$PATH

# Preferred editor
export EDITOR=${EDITOR:-vim}

# Prefer US English and use UTF-8.
export LANG="en_US.UTF-8"
export LC_ALL="en_US.UTF-8"

# Highlight section titles in manual pages.
export LESS_TERMCAP_md="${yellow}"

# Don’t clear the screen after quitting a manual page.
export MANPAGER="less -X"

# Define bat config
export BAT_CONFIG_PATH="$HOME/.batconfig"

# Setup SSH
export SSH_KEY_PATH="$HOME/.ssh/personal"
ssh-add $SSH_KEY_PATH

# Setup zsh
export ZSH_CACHE_DIR=$HOME/.zsh
export ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE="fg=#888"
export ZSH_THEME=""
export ENABLE_CORRECTION="false"
export COMPLETION_WAITING_DOTS="false"
export HIST_STAMPS="dd/mm/yyyy"
export HISTSIZE=250000
export SAVESIZE=25000

# You Should Use
export YSU_MODE=ALL

# Load starship
export STARSHIP_CONFIG=$HOME/.starship.toml
eval "$(starship init zsh)"

# Load all plugins
eval "$(sheldon source)"
