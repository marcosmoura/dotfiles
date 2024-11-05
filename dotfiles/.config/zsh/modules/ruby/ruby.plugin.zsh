#!/usr/bin/env zsh

source ~/.config/zsh/utils.sh

# Init rbenv
export RBENV_VERSION=$(rbenv install -l -s | grep -v - | tail -1)
eval "$(rbenv init - zsh)"
rbenv global $RBENV_VERSION
