. dotfiles/.config/zsh/utils.sh

print_purple "$TEXT_SEPARATOR"
print_purple "                 💻  Marcos Moura Dotfiles"
print_purple "$TEXT_SEPARATOR\n"

. installation/preinstall.sh
. installation/symlinks.sh

# macOS
is_macos && . installation/macos/install.sh

# Linux
is_linux && . installation/linux/install.sh

. installation/apps.sh
. installation/zsh.sh
. installation/node.sh
. installation/ruby.sh
. installation/python.sh
. installation/rust.sh
. installation/go.sh
. installation/apps.sh
. installation/packages.sh
. installation/postinstall.sh

print_green "\n$TEXT_SEPARATOR"
print_green "🎉 Dotfiles installed and configured! Reloading shell... 😊"
print_green "$TEXT_SEPARATOR\n"

exec $SHELL -l
reload
