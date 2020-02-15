#!/bin/sh

symlink_dotfile() {
  ln -sfvF $(grealpath $1) "$HOME/$1"
}

reset
printMsg "DOTFILES" "Creating symlinks..."

pushd ./dots
symlink_dotfile .alacritty.yml
symlink_dotfile .editorconfig
symlink_dotfile .gitconfig
symlink_dotfile .hammerspoon
symlink_dotfile .ssh-config
symlink_dotfile .starship.toml
symlink_dotfile .vuerc
symlink_dotfile .zsh_aliases
symlink_dotfile .zsh_functions
symlink_dotfile .zsh_plugins
symlink_dotfile .zshrc

# SSH
mkdir "$HOME/.ssh"
ln -sfv $(grealpath ssh-config) "$HOME/.ssh/config"
popd

printSuccess "DOTFILES" "Created with success..."
