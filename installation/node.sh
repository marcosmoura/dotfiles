print_start "Installing Node\n"

which -s node
if [[ $? != 0 ]]; then
  brew install node npm yarn pnpm
  brew tap oven-sh/bun
  brew install bun
fi

print_progress "Installing yarn global packages"

pnpm i -g @fsouza/prettierd
pnpm i -g @johnnymorganz/stylua-bin
pnpm i -g @vscode/codicons
pnpm i -g eslint
pnpm i -g eslint_d
pnpm i -g nx
pnpm i -g prettier
pnpm i -g stylelint
pnpm i -g typescript

print_success "Node installed! \n"
