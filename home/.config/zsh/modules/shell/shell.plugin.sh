#!/bin/bash

# Open zsh config
alias dotfiles="code ~/Projects/dotfiles"

# Open zsh config
alias zshconfig="code ~/.zshrc"

# Always enable colored `grep` output
# Note: `GREP_OPTIONS="--color=auto"` is deprecated, hence the alias usage.
alias grep='grep --color=auto'
alias fgrep='fgrep --color=auto'
alias egrep='egrep --color=auto'

# sudo editors
alias vim='nvim'
alias svim='sudo nvim'
alias snano='sudo nano'

# Better du
alias du='dust -x -X .git -X node_modules'

# Better man
alias help='tldr'
alias man='batman'

# Chmod -x
alias chmox='chmod -x'

# Better bottom
alias bottom='btm'

# Zellij alias
export ZELLIJ_RUNNER_LAYOUTS_DIR="$HOME/.config/zellij/layouts"
export ZELLIJ_RUNNER_BANNERS_DIR="$HOME/.config/zellij/banners"
export ZELLIJ_RUNNER_ROOT_DIR="$HOME/Projects"
export ZELLIJ_RUNNER_IGNORE_DIRS="node_modules,target"

alias zl='zellij'
alias zr='zellij-runner'

# Better FZF
export FZF_DEFAULT_OPTS=" \
--color=fg:#cdd6f4,header:#f38ba8,info:#cba6f7,pointer:#f5e0dc,gutter:-1 \
--color=marker:#b4befe,fg+:#cdd6f4,prompt:#cba6f7,hl+:#f38ba8 \
--color=selected-bg:#45475a \
--multi"

# FZF with unique list filtering
function fzfu() {
  awk '!x[$0]++' | fzf
}

# Better Glamour
export GLAMOUR_STYLE="$HOME/.config/glamour/catppuccin.json"

# Better tree
alias tree="tree --gitignore --dirsfirst --sort name -C"

# Reload shell
function reload() {
  exec $SHELL -l
}
