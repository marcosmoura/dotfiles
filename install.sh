#!/bin/sh

source home/.config/zsh/utils.sh

print_purple "$TEXT_SEPARATOR"
print_purple "          Marcos Moura Dotfiles          "
print_purple "$TEXT_SEPARATOR\n"

print_text "💻 Installing all dotfiles..."
print_text "$TEXT_SEPARATOR\n"

# Load installation scripts
source installation/preinstall.sh
# source installation/macos.sh
# source installation/brew.sh
source installation/symlinks.sh
# source installation/zsh.sh
# source installation/node.sh
# source installation/python.sh
# source installation/ruby.sh
# source installation/rust.sh
# source installation/go.sh
source installation/bin.sh
# source installation/postinstall.sh

print_green "🎉 Dotfiles installed and configured!"
print_green "✅ Reloading shell! 😊"
print_green "$TEXT_SEPARATOR\n"

exec $SHELL -l

reload
