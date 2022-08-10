#!/bin/sh

source dotfiles/.zsh/utils.sh

print_purple "$TEXT_SEPARATOR"
print_purple "          Marcos Moura Dotfiles          "
print_purple "$TEXT_SEPARATOR\n"

print_text "💻 Installing all dotfiles..."
print_text "$TEXT_SEPARATOR\n"


# Load installation scripts
source scripts/preinstall.sh
source scripts/macos.sh
source scripts/zsh.sh
source scripts/brew.sh
source scripts/node.sh
source scripts/python.sh
source scripts/ruby.sh
source scripts/apps.sh
source scripts/packages.sh
source scripts/symlinks.sh
source scripts/postinstall.sh


print_green "🎉 Dotfiles installed and configured!"
print_green "✅ Reloading shell! 😊"
print_green "$TEXT_SEPARATOR\n"

exec $SHELL -l
