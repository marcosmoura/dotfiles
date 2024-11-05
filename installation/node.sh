print_start "Installing Node packages"

curl -fsSL https://bun.sh/install | bash

pnpm i -g @johnnymorganz/stylua-bin
pnpm i -g @vscode/codicons
pnpm i -g nx
pnpm i -g prettier
pnpm i -g stylelint
pnpm i -g typescript

is_macos && pnpm i -g wallpaper

print_success "Node packages installed! \n"
