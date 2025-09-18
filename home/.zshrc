# Homebrew
eval "$(/opt/homebrew/bin/brew shellenv)"
if type brew &>/dev/null; then
  FPATH="$(brew --prefix)/share/zsh/site-functions:${FPATH}"
fi

# Paths
export XDG_CONFIG_HOME=${XDG_CONFIG_HOME:-$HOME/.config}

# Path helper to avoid duplicate entries
path_prepend() {
  [ -d "$1" ] || return 0
  case ":$PATH:" in
  *":$1:"*) ;; # already present
  *) PATH="$1:$PATH" ;;
  esac
}

local paths=(
  /usr/local/bin
  /usr/local/opt
  "$HOME/.local/bin"
  "$HOME/.rbenv/shims"
  "$HOME/.yarn/bin"
  "$HOME/.config/yarn/global/node_modules/.bin"
  "$HOME/go/bin"
  "$HOME/.cargo/bin"
  "$HOME/.local/share/venv/bin"
)

for p in $paths; do
  path_prepend $p
done

# Avoid duplicate entries in PATH
typeset -U path PATH

# Preferred editor
export EDITOR=$(which nvim)

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
export ZSH_CACHE_DIR=$HOME/.config/zsh
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
export STARSHIP_CONFIG=$XDG_CONFIG_HOME/starship/starship.toml
eval "$(starship init zsh)"

# SSH Agent
SSH_AGENT_INSTANCES=$(pgrep ssh-agent)
if [ -z "${SSH_AGENT_INSTANCES}" ]; then
  eval "$(ssh-agent -s)"
  trap "ssh-agent -k" exit
fi

# Load sheldon
eval "$(sheldon source)"

# Clear screen
clear
systeminfo
