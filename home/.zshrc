# Homebrew - static setup to avoid slow brew shellenv calls
export HOMEBREW_PREFIX="/opt/homebrew"
export HOMEBREW_CELLAR="/opt/homebrew/Cellar"
export HOMEBREW_REPOSITORY="/opt/homebrew"
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin${PATH+:$PATH}"
export MANPATH="/opt/homebrew/share/man${MANPATH+:$MANPATH}:"
export INFOPATH="/opt/homebrew/share/info:${INFOPATH:-}"
FPATH="/opt/homebrew/share/zsh/site-functions:${FPATH}"

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

# Load sheldon
eval "$(sheldon source)"

# Load starship
export STARSHIP_CONFIG=$XDG_CONFIG_HOME/starship/starship.toml
export STARSHIP_EMOJI=$($XDG_CONFIG_HOME/starship/scripts/emoji.sh)
export STARSHIP_CLOCK=$($XDG_CONFIG_HOME/starship/scripts/clock.sh)
eval "$(starship init zsh)"

# Clear screen
clear
systeminfo
