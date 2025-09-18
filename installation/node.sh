#!/usr/bin/env bash

print_start "Installing Node"

tools=(
  bun
  node
  pnpm
  yarn
)
for t in "${tools[@]}"; do
  if ! command -v "$t" >/dev/null 2>&1; then
    brew install "$t" || true
  fi
done

print_progress "Installing global packages"
global_packages=(
  @fsouza/prettierd
  @johnnymorganz/stylua-bin
  @vscode/codicons
  nx
  prettier
  stylelint
  typescript
)
for pkg in "${global_packages[@]}"; do
  pnpm add -g "$pkg" --dangerously-allow-all-builds
done

print_progress "Installing cspell + dictionaries"
if ! command -v cspell >/dev/null 2>&1; then
  pnpm add -g cspell --dangerously-allow-all-builds
fi

cspell_dictionaries=(
  @cspell/dict-companies
  @cspell/dict-css
  @cspell/dict-en-common-misspellings
  @cspell/dict-filetypes
  @cspell/dict-fonts
  @cspell/dict-html
  @cspell/dict-html-symbol-entities
  @cspell/dict-lua
  @cspell/dict-markdown
  @cspell/dict-node
  @cspell/dict-npm
  @cspell/dict-people-names
  @cspell/dict-pt-br
  @cspell/dict-public-licenses
  @cspell/dict-rust
  @cspell/dict-shell
  @cspell/dict-software-terms
  @cspell/dict-typescript
  @cspell/dict-vim
)

existing_links=$(cspell link list 2>/dev/null || true)

for dict in "${cspell_dictionaries[@]}"; do
  pnpm add -g "$dict" --dangerously-allow-all-builds

  if ! echo "$existing_links" | grep -q "$dict"; then
    cspell link add "$dict" || true
  fi
done

print_success "Node installed!"
