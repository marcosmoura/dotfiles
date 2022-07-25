print_start "Installing zsh"

ZSH_DIR=$(which zsh)

if ! brew ls --versions zsh > /dev/null; then
  brew install zsh
fi

if ! grep -Fxq $ZSH_DIR /etc/shells; then
  print_progress "Adding zsh to /etc/shells"
  sudo sh -c 'echo $ZSH_DIR >> /etc/shells'
fi

if ! echo $SHELL | grep -Fxq $ZSH_DIR; then
  print_progress "Setting as default shell"
  chsh -s $ZSH_DIR
fi

if ! brew ls --versions sheldon > /dev/null; then
  brew install sheldon
  sheldon lock --reinstall
fi


print_success "zsh installed! \n"
