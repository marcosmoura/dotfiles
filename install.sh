#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

# shellcheck disable=SC1091
source home/.config/zsh/utils.sh

clear

print_purple "$TEXT_SEPARATOR"
print_purple "          Marcos Moura Dotfiles          "
print_purple "$TEXT_SEPARATOR"

print_text "💻 Installing all dotfiles..."
print_text "$TEXT_SEPARATOR"

scripts=(
  preinstall
  macos
  brew
  symlinks
  zsh
  node
  python
  ruby
  rust
  postinstall
)
for s in "${scripts[@]}"; do
  # shellcheck disable=SC1090
  . "installation/${s}.sh"
done

print_green "🎉 Dotfiles installed and configured!"
print_green "✅ Reloading shell! 😊"
print_green "$TEXT_SEPARATOR"

exec "$SHELL" -l
