#!/usr/bin/env bash

print_start "Installing Ruby"

if ! command -v rbenv >/dev/null 2>&1; then
  brew install rbenv
fi

# Pick latest stable semantic version
RBENV_VERSION=$(rbenv install -l 2>/dev/null | awk '/^  [0-9]+\.[0-9]+\.[0-9]+$/ {print $1}' | tail -1)
export RBENV_VERSION

eval "$(rbenv init - zsh)"
rbenv install -s "$RBENV_VERSION"
rbenv global "$RBENV_VERSION"

print_progress "Installing gems"

gems=(
  bundler
  openssl
  rake
  rdoc
  rubygems-update
  sqlite3
)

for g in "${gems[@]}"; do
  if ! gem list -i "$g" >/dev/null 2>&1; then
    gem install "$g"
  fi
done

print_success "Ruby installed!"
