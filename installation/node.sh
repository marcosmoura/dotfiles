print_start "Installing Node\n"

which -s node
if [[ $? != 0 ]]; then
  brew install node npm yarn pnpm
  brew tap oven-sh/bun
  brew install bun
fi

print_progress "Installing yarn global packages"

yarn global add eslint
yarn global add nx
yarn global add prettier
yarn global add typescript

print_success "Node installed! \n"
