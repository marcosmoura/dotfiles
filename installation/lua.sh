#!/usr/bin/env bash

print_start "Installing Lua"

lua_packages=(
  lua
  lua-language-server
  luajit
  luarocks
)

if ! command -v lua >/dev/null 2>&1; then
  brew install "${lua_packages[@]}"
fi

print_progress "Installing Lua packages"

lua_rocks_packages=(
  catppuccin
  inspect
  lua-import
  lunajson
  luv
)

for pkg in "${lua_rocks_packages[@]}"; do
  if ! luarocks list --porcelain | grep "$pkg"; then
    luarocks install "$pkg" || true
  fi
done

print_success "Lua installed!"
