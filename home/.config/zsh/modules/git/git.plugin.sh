#!/usr/bin/env bash

# Simple git
alias g='git'

# Go to git root
alias groot='cd `git rev-parse --show-toplevel`'

# Autocomplete git custom command
zstyle ':completion:*:*:git:*' user-commands go:'switch to a branch or create a new one'
zstyle ':completion:*:*:git:*' user-commands sync-fork:'sync forked repo with upstream'
zstyle ':completion:*:*:git:*' user-commands l:'short log'
zstyle ':completion:*:*:git:*' user-commands fm:'find commits by message'
zstyle ':completion:*:*:git:*' user-commands fc:'find commits by path'
zstyle ':completion:*:*:git:*' user-commands give-credit:'give author credits to a commit'
zstyle ':completion:*:*:git:*' user-commands delete-merged:'delete merged branches'

_git-go() {
  _git-branch
}

_git-sync-fork() {
  _git-branch
}

_git-l() {
  _git-log
}

_git-fm() {
  _git-log
}

_git-fc() {
  _git-log
}

_git-give-credit() {
  _git-commit
}

_git-delete-merged() {
  _git-branch
}
