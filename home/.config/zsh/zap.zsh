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
# OH-MY-ZSH LIBRARIES & PLUGINS
# ==============================================================================
# Clone ohmyzsh repo (noop if already present), then source individual pieces

plug "ohmyzsh/ohmyzsh"

OMZ_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/zap/plugins/ohmyzsh"

# Core libs
for _omz_lib in compfix completion git grep history key-bindings; do
  [[ -f "$OMZ_DIR/lib/${_omz_lib}.zsh" ]] && source "$OMZ_DIR/lib/${_omz_lib}.zsh"
done
unset _omz_lib

# Plugins
for _omz_plug in aliases cp dircycle github zoxide; do
  [[ -f "$OMZ_DIR/plugins/${_omz_plug}/${_omz_plug}.plugin.zsh" ]] && \
    source "$OMZ_DIR/plugins/${_omz_plug}/${_omz_plug}.plugin.zsh"
done
unset _omz_plug OMZ_DIR

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
