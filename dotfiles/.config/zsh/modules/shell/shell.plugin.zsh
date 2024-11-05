#!/usr/bin/env zsh

source ~/.config/zsh/utils.sh

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
alias slvim='sudo lvim'
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

# Better FZF
export FZF_DEFAULT_OPTS=" \
--color=bg+:#313244,bg:#1e1e2e,spinner:#f5e0dc,hl:#f38ba8 \
--color=fg:#cdd6f4,header:#f38ba8,info:#cba6f7,pointer:#f5e0dc \
--color=marker:#f5e0dc,fg+:#cdd6f4,prompt:#cba6f7,hl+:#f38ba8"

# Better Glamour
export GLAMOUR_STYLE="~/.config/glamour/catppuccin.json"

function reload() {
  exec $SHELL -l
}
