#!/bin/bash

print_start "Installing Ruby"

brew install rbenv
RBENV_VERSION=$(rbenv install -l -s | grep -v - | tail -1)
export RBENV_VERSION

eval "$(rbenv init - zsh)"
rbenv install -s "$RBENV_VERSION"
rbenv global "$RBENV_VERSION"

print_progress "Installing gems"

gem install bundler
gem install openssl
gem install rake
gem install rdoc
gem install rubygems-update
gem install sqlite3

print_success "Ruby installed! \n"
