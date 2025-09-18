#!/usr/bin/env bash

print_start "Cleaning up and updating everything"

print_progress "Cleaning brew cache"

brew cleanup

print_progress "Updating MacOS"

sudo softwareupdate -i -a

# Install Command Line Tools only if not already present (avoid repeated GUI prompts)
if ! xcode-select -p >/dev/null 2>&1; then
  xcode-select --install
else
  print_info "Command Line Tools already installed"
fi

print_progress "Resetting terminal theme"
if command -v fast-theme >/dev/null 2>&1; then
  fast-theme "$XDG_CONFIG_HOME/syntax-theme/syntax-theme.ini"
else
  print_info "fast-theme not installed; skipping"
fi

print_success "Clean up complete!"
