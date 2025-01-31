#!/usr/bin/env zsh

setopt auto_pushd
setopt pushd_ignore_dups
setopt pushdminus
setopt autocd

# So these commands can be executed with sudo
alias sudo="sudo "

# Quickly move to folder
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'
alias .....='cd ../../../..'
alias ......='cd ../../../../..'
alias .......='cd ../../../../../..'
alias ~="cd ~"

# Always use color output for `ls`
alias ls="eza -a -s=type --group-directories-first --icons=always --color=always --hyperlink --space-between-columns=3"

# List all files colorized in long format
alias la="ls -l -a -h -F=always --git"

# List all files colorized in short format
alias ll='ls -l -h'

# List only directories
alias lsd="ll -l -D"

# Create a new directory and enter it
function mkd() {
  mkdir -p "$@" && cd "$_"
}
