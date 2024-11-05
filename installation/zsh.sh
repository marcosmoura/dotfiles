print_start "Configuring zsh"

ZSH_DIR=$(which zsh)

print_progress "Adding zsh to /etc/shells"
sudo sh -c "echo $(which zsh) >> /etc/shells"

if ! echo $SHELL | grep -Fxq "$ZSH_DIR"; then
  print_progress "Setting as default shell"
  chsh -s $ZSH_DIR
fi

sheldon lock --reinstall

print_success "zsh installed! \n"
