# ╔══════════════════════════════════════════════════════════════╗
# ║  .zshrc — Interactive shell configuration                   ║
# ║  Loaded for every interactive session (after .zprofile)     ║
# ╚══════════════════════════════════════════════════════════════╝

ZSH_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/zsh"

# History
source "$ZSH_DIR/history.zsh"

# Secrets (API keys from ~/.secrets/)
source "$ZSH_DIR/secrets.zsh"

# Zsh autosuggestions style
export ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE="fg=#888"

# You Should Use
export YSU_MODE=ALL

# Plugin manager (zplug)
source "$ZSH_DIR/zplug.zsh"

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
