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
alias ls="exa -a -s type --group-directories-first --git --icons --color always"

# List all files colorized in long format
alias la="ls -laFh"

# List all files colorized in short format
alias ll='ls -lh'

# List only directories
alias lsd="ls -lD"

# Create a new directory and enter it
function mkd() {
  mkdir -p "$@" && cd "$_";
}
