print_start "Linking dotfiles\n"

function create_symlink() {
  ln -sfvF $(grealpath $1) "$HOME/$1"
}

shopt -s dotglob

pushd ./dotfiles > /dev/null

for file in *; do
  rm -rf "$HOME/$file"
  create_symlink "$(basename "$file")" > /dev/null 2>&1
  print_purple "📁 Linked $file"
done

# Make Config folder
HOME_CONFIG="$HOME/.config"
mkdir -p "$HOME_CONFIG"

# Override Kitty config
rm -rf "$HOME_CONFIG/kitty"
mv "$HOME/kitty" "$HOME_CONFIG/kitty"

# Override Macchina config
rm -rf "$HOME_CONFIG/macchina"
mv "$HOME/macchina" "$HOME_CONFIG/macchina"

shopt -u dotglob

popd > /dev/null

print_success "Everything linked! \n"
