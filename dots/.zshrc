# Path
export PATH=/usr/local/sbin:$PATH
export PATH=/usr/local/bin:$PATH
export PATH=$HOME/.rbenv/shims:$PATH

# Preferred editor for local and remote sessions
export EDITOR="vim"

# Prefer US English and use UTF-8.
export LANG="en_US.UTF-8"
export LC_ALL="en_US.UTF-8"

# Highlight section titles in manual pages.
export LESS_TERMCAP_md="${yellow}"

# Don’t clear the screen after quitting a manual page.
export MANPAGER="less -X"

# Define bat config
export BAT_CONFIG_PATH="$HOME/.batconfig"

# Setup ssh
export SSH_KEY_PATH="$HOME/.ssh/personal"
ssh-add $SSH_KEY_PATH

# Terminal with 256 colors
TERM=xterm-256color
export LS_COLORS="$(vivid generate snazzy)"
export EXA_COLORS="$(vivid generate snazzy)"

# Setup zsh
autoload -U compinit && compinit
export ZSH_CACHE_DIR=$HOME/.zsh
export ZSH=$(antibody home)/https-COLON--SLASH--SLASH-github.com-SLASH-robbyrussell-SLASH-oh-my-zsh # Temporary fix
export ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE="fg=#888"

ZSH_THEME=""
ENABLE_CORRECTION="false"
COMPLETION_WAITING_DOTS="false"
HIST_STAMPS="dd/mm/yyyy"

# rbenv
export RBENV_VERSION=3.0.0
eval "$(rbenv init -)"

# Setup starship prompt
export STARSHIP_CONFIG=$HOME/.starship.toml
eval "$(starship init zsh)"

# zsh plugins
source $HOME/.zsh_plugins.sh
eval "$(thefuck --alias)"

# Load aliases and functions
source $HOME/.zsh_aliases
source $HOME/.zsh_functions
