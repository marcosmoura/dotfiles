# ╔══════════════════════════════════════════════════════════════╗
# ║  .zprofile — Login shell environment                        ║
# ║  Loaded once per login session (before .zshrc)              ║
# ╚══════════════════════════════════════════════════════════════╝

# Homebrew — static setup to avoid slow brew shellenv calls
export HOMEBREW_PREFIX="/opt/homebrew"
export HOMEBREW_CELLAR="/opt/homebrew/Cellar"
export HOMEBREW_REPOSITORY="/opt/homebrew"
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin${PATH+:$PATH}"
export MANPATH="/opt/homebrew/share/man${MANPATH+:$MANPATH}:"
export INFOPATH="/opt/homebrew/share/info:${INFOPATH:-}"
FPATH="/opt/homebrew/share/zsh/site-functions:${FPATH}"

# XDG Base Directories
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"
export XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"

# Core environment — nvim is always installed via Brewfile
export EDITOR="nvim"
export VISUAL="$EDITOR"
export LANG="en_US.UTF-8"
export LC_ALL="en_US.UTF-8"

# Pager
export LESS_TERMCAP_md=$'\e[1;33m'
export MANPAGER="less -X"
export PAGER="less"

# Bat
export BAT_CONFIG_PATH="$XDG_CONFIG_HOME/bat/batconfig"

# PATH additions — deduplicated via path_prepend
path_prepend() {
  [ -d "$1" ] || return 0
  case ":$PATH:" in
  *":$1:"*) ;;
  *) PATH="$1:$PATH" ;;
  esac
}

path_prepend /usr/local/bin
path_prepend /usr/local/opt
path_prepend "$HOME/.local/bin"
path_prepend "$HOME/.opencode/bin"
path_prepend "$HOME/.yarn/bin"
path_prepend "$HOME/.config/yarn/global/node_modules/.bin"
path_prepend "$HOME/go/bin"
path_prepend "$HOME/.cargo/bin"
path_prepend "$HOME/.local/share/venv/bin"
path_prepend /opt/homebrew/opt/rustup/bin

unfunction path_prepend

# Avoid duplicate PATH entries
typeset -U path PATH
