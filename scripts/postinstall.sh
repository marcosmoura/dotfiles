print_start "Cleaning up and updating everything"


print_progress "Cleaning brew cache"

brew cleanup


print_progress "Updating MacOS"

sudo softwareupdate -i -a;
"xcode-select --install"


print_progress "Resetting terminal"

fast-theme ~/syntax-theme.ini


print_success "Clean up complete! \n"
