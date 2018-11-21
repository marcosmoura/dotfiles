#!/bin/sh

source ./setup.sh
source ./scripts/brew.sh
source ./scripts/cask.sh
source ./scripts/macos.sh
source ./scripts/symlinks.sh
source ./scripts/zsh.sh
source ./scripts/development.sh
source ./scripts/update.sh
source "$HOME/.zshrc"

printSuccess "DONE" "Installation complete..."
