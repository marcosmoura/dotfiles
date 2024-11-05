print_start "Linking dotfiles"
print_text ""

function create_symlink() {
  local absolute_path=""

  which grealpath >/dev/null 2>&1
  if [ $? -eq 0 ]; then
    absolute_path=$(grealpath $1)
  else
    absolute_path=$(readlink -f $1)
  fi

  # If $2 is set, use it as the destination, otherwise use $1
  if [ -z "$2" ]; then
    ln -sfvF $absolute_path $HOME/$1
  else
    ln -sfvF $absolute_path $HOME/$2
  fi
}

shopt -s dotglob

pushd ./dotfiles >/dev/null

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
