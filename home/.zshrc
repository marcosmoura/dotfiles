# ╔══════════════════════════════════════════════════════════════╗
# ║  .zshrc — Interactive shell configuration                   ║
# ║  Loaded for every interactive session (after .zprofile)     ║
# ╚══════════════════════════════════════════════════════════════╝

ZSH_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/zsh"

# Ensure Homebrew is in PATH for non-login shells (e.g. zsh -i, tmux)
if [[ -z "$HOMEBREW_PREFIX" ]]; then
  export HOMEBREW_PREFIX="/opt/homebrew"
  export HOMEBREW_CELLAR="/opt/homebrew/Cellar"
  export HOMEBREW_REPOSITORY="/opt/homebrew"
  export PATH="/opt/homebrew/bin:/opt/homebrew/sbin${PATH+:$PATH}"
  export MANPATH="/opt/homebrew/share/man${MANPATH+:$MANPATH}:"
  export INFOPATH="/opt/homebrew/share/info:${INFOPATH:-}"
  FPATH="/opt/homebrew/share/zsh/site-functions:${FPATH}"
fi

# History
source "$ZSH_DIR/history.zsh"

# Secrets (API keys from ~/.secrets/)
source "$ZSH_DIR/secrets.zsh"

# Zsh autosuggestions style
export ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE="fg=#888"

# You Should Use
export YSU_MODE=ALL

# Plugin manager (zap)
source "$ZSH_DIR/zap.zsh"

# Prompt (starship)
export STARSHIP_CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/starship/starship.toml"
export STARSHIP_EMOJI=$("${XDG_CONFIG_HOME:-$HOME/.config}/starship/scripts/emoji.sh")
export STARSHIP_CLOCK=$("${XDG_CONFIG_HOME:-$HOME/.config}/starship/scripts/clock.sh")
eval "$(starship init zsh)"

# Welcome screen on login shells
if [[ -o login ]]; then
  clear
  command -v systeminfo &>/dev/null && systeminfo
fi

# pnpm
export PNPM_HOME="/Users/marcosmoura/.local/share/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end
