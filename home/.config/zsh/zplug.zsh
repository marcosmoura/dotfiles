#!/usr/bin/env zsh
# zplug plugin manager configuration
# Loaded by .zshrc

# Initialize zplug
export ZPLUG_HOME="$(brew --prefix)/opt/zplug"
source "$ZPLUG_HOME/init.zsh"

# ==============================================================================
# CORE SYSTEM MODULES (Load first - no defer)
# ==============================================================================
# Essential functionality that needs to load early

zplug "~/.config/zsh/plugins", from:local, use:"compinit.plugin.sh"
zplug "~/.config/zsh/plugins", from:local, use:"macOS.plugin.sh"

# ==============================================================================
# OH-MY-ZSH FOUNDATION
# ==============================================================================
# Core zsh functionality from oh-my-zsh lib directory

zplug "ohmyzsh/ohmyzsh", use:"lib/compfix.zsh"
zplug "ohmyzsh/ohmyzsh", use:"lib/completion.zsh"
zplug "ohmyzsh/ohmyzsh", use:"lib/git.zsh"
zplug "ohmyzsh/ohmyzsh", use:"lib/grep.zsh"
zplug "ohmyzsh/ohmyzsh", use:"lib/history.zsh"
zplug "ohmyzsh/ohmyzsh", use:"lib/key-bindings.zsh"

# Oh-my-zsh plugins (deferred)
zplug "ohmyzsh/ohmyzsh", use:"plugins/aliases/aliases.plugin.zsh", defer:2
zplug "ohmyzsh/ohmyzsh", use:"plugins/cp/cp.plugin.zsh", defer:2
zplug "ohmyzsh/ohmyzsh", use:"plugins/dircycle/dircycle.plugin.zsh", defer:2
zplug "ohmyzsh/ohmyzsh", use:"plugins/github/github.plugin.zsh", defer:2
zplug "ohmyzsh/ohmyzsh", use:"plugins/zoxide/zoxide.plugin.zsh", defer:2

# ==============================================================================
# SHELL ENHANCEMENTS
# ==============================================================================
# Visual and interactive improvements (deferred)

zplug "chrissicool/zsh-256color", defer:2
zplug "marcosmoura/fast-syntax-highlighting", defer:2
zplug "zsh-users/zsh-autosuggestions", defer:2
zplug "MichaelAquilina/zsh-you-should-use", defer:2

# ==============================================================================
# COMPLETION SYSTEM
# ==============================================================================
# Tab completion for various tools and commands (deferred)

zplug "zsh-users/zsh-completions", defer:2

# Custom completion from dotfiles (not deferred - needed early)
zplug "~/.config/zsh/plugins", from:local, use:"completions.plugin.sh"

# pnpm completion (deferred)
zplug "g-plane/pnpm-shell-completion", defer:2

# ==============================================================================
# NAVIGATION & UTILITIES
# ==============================================================================
# Tools for better directory navigation (deferred)

zplug "ajeetdsouza/zoxide", use:"zoxide.zsh", defer:2

# ==============================================================================
# CUSTOM DOTFILES MODULES
# ==============================================================================
# Personal shell configuration modules (deferred)

# Environment setup
zplug "~/.config/zsh/plugins", from:local, use:"env.plugin.sh", defer:2

# Other custom plugins (excluding compinit, completions, env, macOS which are loaded above)
zplug "~/.config/zsh/plugins", from:local, use:"directories.plugin.sh", defer:2
zplug "~/.config/zsh/plugins", from:local, use:"git.plugin.sh", defer:2
zplug "~/.config/zsh/plugins", from:local, use:"node.plugin.sh", defer:2
zplug "~/.config/zsh/plugins", from:local, use:"shell.plugin.sh", defer:2

# ==============================================================================
# INSTALL AND LOAD
# ==============================================================================

# Install plugins if there are plugins that have not been installed
if ! zplug check --verbose; then
  zplug install
fi

# Source plugins
zplug load
