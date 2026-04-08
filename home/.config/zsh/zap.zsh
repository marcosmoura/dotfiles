#!/usr/bin/env zsh
# Zap plugin manager configuration
# Loaded by .zshrc

# Initialize zap
[ -f "${XDG_DATA_HOME:-$HOME/.local/share}/zap/zap.zsh" ] && source "${XDG_DATA_HOME:-$HOME/.local/share}/zap/zap.zsh"

# ==============================================================================
# CORE SYSTEM MODULES (Load first)
# ==============================================================================

plug "$HOME/.config/zsh/plugins/compinit.plugin.sh"
plug "$HOME/.config/zsh/plugins/macOS.plugin.sh"

# ==============================================================================
# OH-MY-ZSH FOUNDATION
# ==============================================================================

plug "ohmyzsh/ohmyzsh" # Base lib (completion, git, history, key-bindings, etc.)

# ==============================================================================
# SHELL ENHANCEMENTS
# ==============================================================================

plug "chrissicool/zsh-256color"
plug "marcosmoura/fast-syntax-highlighting"
plug "zsh-users/zsh-autosuggestions"
plug "MichaelAquilina/zsh-you-should-use"

# ==============================================================================
# COMPLETION SYSTEM
# ==============================================================================

plug "zsh-users/zsh-completions"
plug "$HOME/.config/zsh/plugins/completions.plugin.sh"
plug "g-plane/pnpm-shell-completion"

# ==============================================================================
# CUSTOM DOTFILES MODULES
# ==============================================================================

plug "$HOME/.config/zsh/plugins/env.plugin.sh"
plug "$HOME/.config/zsh/plugins/directories.plugin.sh"
plug "$HOME/.config/zsh/plugins/git.plugin.sh"
plug "$HOME/.config/zsh/plugins/node.plugin.sh"
plug "$HOME/.config/zsh/plugins/shell.plugin.sh"
