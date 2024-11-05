# Enable Powerlevel10k instant prompt
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-\${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-\${(%):-%n}.zsh"
fi

# Path
function add_to_path {
  if [ -d "$1" ] && [[ ":$PATH:" != *":$1:"* ]]; then
    export PATH="${PATH:+"$PATH:"}$1"
  fi
}

function flatten_path {
  printf "%s" "$PATH" | awk -v RS=':' '!a[$1]++ { if (NR > 1) printf RS; printf $1 }'
}

export XDG_CONFIG_HOME=${XDG_CONFIG_HOME:-$HOME/.config}
add_to_path /usr/local/bin
add_to_path /usr/local/opt
add_to_path $HOME/.local/bin
add_to_path $HOME/.rbenv/shims
add_to_path $HOME/.yarn/bin
add_to_path $XDG_CONFIG_HOME/yarn/global/node_modules/.bin
add_to_path $HOME/go/bin
add_to_path $HOME/.cargo/bin
add_to_path $HOME/.local/share/venv/bin/python
add_to_path $HOME/.local/share/venv/bin/pip

# Preferred editor
export EDITOR=vim

# Prefer US English and use UTF-8.
export LANG="en_US.UTF-8"
export LC_ALL="en_US.UTF-8"

# Highlight section titles in manual pages.
export LESS_TERMCAP_md="${yellow}"

# Don’t clear the screen after quitting a manual page.
export MANPAGER="less -X"

# Define bat config
export BAT_CONFIG_PATH="$XDG_CONFIG_HOME/bat/batconfig"

# Setup zsh
export ZSH_CACHE_DIR=$XDG_CONFIG_HOME/zsh
export ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE="fg=#888"
export ZSH_THEME=""
export ENABLE_CORRECTION="false"
export COMPLETION_WAITING_DOTS="false"
export HIST_STAMPS="dd/mm/yyyy"
export HISTSIZE=250000
export SAVESIZE=25000

# You Should Use
export YSU_MODE=ALL

# Load powerlevel10k
[[ ! -f ~/.config/p10k/.p10k.zsh ]] || source ~/.config/p10k/.p10k.zsh

# SSH Agent
SSH_AGENT_INSTANCES=$(pgrep ssh-agent)
if [ -z "${SSH_AGENT_INSTANCES}" ]; then
  eval $(ssh-agent -s)
  trap "ssh-agent -k" exit
fi

# Load sheldon
eval "$(sheldon source)"
eval "$(sheldon completions --shell zsh)"

# FZF
source <(fzf --zsh)

# Clear screen
clear
systeminfo

# bun completions
[ -s "/home/marcosmoura/.bun/_bun" ] && source "/home/marcosmoura/.bun/_bun"
