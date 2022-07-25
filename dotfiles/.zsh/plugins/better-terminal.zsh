#!/usr/bin/env zsh

# Alias to VSCode
alias code='code-insiders '
alias c='code-insiders '

# Always enable colored `grep` output
# Note: `GREP_OPTIONS="--color=auto"` is deprecated, hence the alias usage.
alias grep='grep --color=auto'
alias fgrep='fgrep --color=auto'
alias egrep='egrep --color=auto'

# sudo editors
alias vim='nvim'
alias svim='sudo vim'
alias snano='sudo nano'

# Better du
alias du='dust -x -X .git -X node_modules'

# Better man
alias help='tldr'
alias man='batman'

# Chmod -x
alias chmox='chmod -x'
