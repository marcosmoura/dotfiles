print_start "Installing Node"

which -s node
if [[ $? != 0 ]] ; then
  print_progress "Installing node"
  brew install node npm yarn
fi

print_progress "Installing yarn global packages"

yarn global add @vue/cli
yarn global add eslint
yarn global add gtop
yarn global add prettier
yarn global add typescript
yarn global add vtop

print_success "Node installed! \n"
