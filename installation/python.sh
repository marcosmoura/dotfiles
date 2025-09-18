#!/usr/bin/env bash

print_start "Installing Python"

tools=(
  python
  pipx
)

for t in "${tools[@]}"; do
  if ! command -v "$t" >/dev/null 2>&1; then
    brew install "$t" || true
  fi
done

print_progress "Installing pip packages"

VENV_DIR="$HOME/.local/share/venv"
if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
fi
source "$VENV_DIR/bin/activate"

packages=(
  psutil
  pynvim
  setuptools
  six
  wheel
)
for p in "${packages[@]}"; do
  python -m pip install --upgrade "$p"
done

print_success "Python installed!"
