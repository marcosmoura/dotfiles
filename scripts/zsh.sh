#!/bin/sh

reset
printMsg "ZSH" "Setting up..."

# Check if zsh is in list of accepted shells
if grep -Fxq "/usr/local/bin/zsh" /etc/shells > /dev/null 2>&1; then
  printSuccess "ZSH" "Already in the list of accepted shells..."
else
  printMsg "ZSH" "Adding to list of accepted shells..."
  sudo sh -c 'echo "/usr/local/bin/zsh" >> /etc/shells'
fi

# Check if zsh is default shell
if echo $SHELL | grep /bin/bash > /dev/null 2>&1; then
  printMsg "ZSH" "Setting as default shell..."
  chsh -s /usr/local/bin/zsh
else
  printSuccess "ZSH" "Already the default shell..."
fi

antibody bundle < ~/.zsh_plugins > ~/.zsh_plugins.sh
antibody update

printMsg "ZSH" "Configured with success!"
