print_progress "Installing Yay"

which yay
if [[ $? != 0 ]]; then
  git clone https://aur.archlinux.org/yay.git

  pushd yay >/dev/null
  makepkg -si
  popd >/dev/null

  rm -rf yay
fi
