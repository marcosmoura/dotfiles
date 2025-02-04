#!/bin/bash

print_start "Installing Node\n"

which -s node
if [[ $? != 0 ]]; then
  brew install node npm yarn pnpm
  brew tap oven-sh/bun
  brew install bun
fi

print_progress "Installing global packages"

global_packages=(
  "@fsouza/prettierd"
  "@johnnymorganz/stylua-bin"
  "@vscode/codicons"
  "eslint_d"
  "eslint"
  "nx"
  "prettier"
  "stylelint"
  "typescript"
)

for package in "${global_packages[@]}"; do
  pnpm i -g "$package"
done

print_progress "Installing cspell"

cspell_dictionaries=(
  "@cspell/dict-companies"
  "@cspell/dict-css"
  "@cspell/dict-en-common-misspellings"
  "@cspell/dict-filetypes"
  "@cspell/dict-fonts"
  "@cspell/dict-html"
  "@cspell/dict-html-symbol-entities"
  "@cspell/dict-lua"
  "@cspell/dict-markdown"
  "@cspell/dict-node"
  "@cspell/dict-npm"
  "@cspell/dict-people-names"
  "@cspell/dict-pt-br"
  "@cspell/dict-public-licenses"
  "@cspell/dict-rust"
  "@cspell/dict-shell"
  "@cspell/dict-software-terms"
  "@cspell/dict-typescript"
  "@cspell/dict-vim"
)

pnpm i -g cspell

for dictionary in "${cspell_dictionaries[@]}"; do
  pnpm i -g "$dictionary"
  cspell link add "$dictionary"
done

print_success "Node installed! \n"
