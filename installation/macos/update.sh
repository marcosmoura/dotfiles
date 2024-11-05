print_progress "Cleaning brew cache"

brew cleanup

print_progress "Updating MacOS"

sudo softwareupdate -i -a
xcode-select --install
