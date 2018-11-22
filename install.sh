#!/bin/sh

source ./setup.sh
source ./scripts/brew.sh
source ./scripts/cask.sh
source ./scripts/macos.sh
source ./scripts/symlinks.sh
source ./scripts/zsh.sh
source ./scripts/development.sh
source ~/.zshrc
source ./scripts/update.sh

printSuccess "DONE" "Installation complete..."
