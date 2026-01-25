#!/usr/bin/env bash

print_start "Installing Ruby (via mise)"

# Ensure mise is available
if ! command -v mise >/dev/null 2>&1; then
  print_error "mise is required but not installed. Please run brew.sh first."
  exit 1
fi

# Install Ruby via mise
print_progress "Installing latest Ruby via mise"
mise install ruby@latest
mise use --global ruby@latest

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
