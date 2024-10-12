#!/bin/sh

. dotfiles/.config/zsh/utils.sh

print_purple "$TEXT_SEPARATOR"
print_purple "          Marcos Moura Dotfiles          "
print_purple "$TEXT_SEPARATOR\n"

print_text "💻 Installing all dotfiles..."
print_text "$TEXT_SEPARATOR\n"

# Load installation scripts
. installation/preinstall.sh
. installation/macos.sh
. installation/brew.sh
. installation/symlinks.sh
. installation/zsh.sh
. installation/node.sh
. installation/python.sh
. installation/ruby.sh
. installation/rust.sh
. installation/go.sh
. installation/apps.sh
. installation/postinstall.sh

print_green "🎉 Dotfiles installed and configured!"
print_green "✅ Reloading shell! 😊"
print_green "$TEXT_SEPARATOR\n"

exec $SHELL -l

reload
