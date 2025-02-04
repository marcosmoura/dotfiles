#!/bin/bash

print_start "Linking dotfiles\n"

function create_symlink() {
  # If $2 is set, use it as the destination, otherwise use $1
  if [ -z "$2" ]; then
    ln -sfvF $(grealpath $1) "$HOME/$1"
  else
    ln -sfvF $(grealpath $1) "$HOME/$2"
  fi
}

shopt -s dotglob

pushd ./home >/dev/null

for file in *; do
  rm -rf "$HOME/$file"
  create_symlink "$(basename "$file")" >/dev/null 2>&1
  print_purple "📁 Linked $file"
done

# Link SSH config
mkdir -p "$HOME/.ssh"
create_symlink ".ssh-config" ".ssh/config" >/dev/null 2>&1
rm -rf "$HOME/.ssh-config"
print_purple "📁 Linked .ssh/config"

shopt -u dotglob

popd >/dev/null

print_success "Everything linked! \n"
