# Aliases. Functions live in ../functions, one per file.

# Lets sudo run an alias: the trailing space makes zsh expand the next word too
alias sudo='sudo '

# ---------------------------------------------------------------------------
# Directories
# ---------------------------------------------------------------------------

alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'
alias .....='cd ../../../..'
alias ......='cd ../../../../..'
alias .......='cd ../../../../../..'
alias ~='cd ~'

# ls is eza: hidden files, directories first, icons, clickable names
alias ls='eza -a -s=type --group-directories-first --icons=always --color=always --hyperlink=always'
alias la='ls -l -a -h -F=always --git' # long, with git status
alias ll='ls -l -h'                    # long
alias lsd='ll -l -D'                   # directories only

alias tree='tree --gitignore --dirsfirst --sort name -C'
alias du='dust -x -X .git -X node_modules'

# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

# Colored grep that skips the directories nobody wants to search.
# `GREP_OPTIONS` is deprecated, hence the alias.
alias grep='grep --color=auto --exclude-dir={.bzr,CVS,.git,.hg,.svn,.idea,.tox,.venv,venv,node_modules}'
alias egrep='grep -E'
alias fgrep='grep -F'

alias vim='nvim'
alias svim='sudo nvim'
alias snano='sudo nano'

alias help='tldr'
alias man='batman'

alias python='python3'
alias pip='pip3'

alias chmox='chmod -x'

# Copy stdin to the clipboard without its newlines
alias copy="tr -d '\n' | pbcopy"

# ---------------------------------------------------------------------------
# Git
# ---------------------------------------------------------------------------

alias g='git'
alias groot='cd `git rev-parse --show-toplevel`'

# ---------------------------------------------------------------------------
# This config
# ---------------------------------------------------------------------------

alias dotfiles='code ~/Projects/dotfiles'
alias zshconfig='code ~/.zshrc'
