#!/usr/bin/env bash

print_start "Installing Python"

if ! command -v mise >/dev/null 2>&1; then
  print_error "mise is required but not installed. Please run brew.sh first."
  exit 1
fi

eval "$(mise activate bash)"

print_progress "Installing latest Python via mise"
mise install python@latest
mise use --global python@latest

print_progress "Installing uv"
if ! command -v uv >/dev/null 2>&1; then
  brew install uv || true
fi

print_progress "Installing pip packages"

VENV_DIR="$HOME/.local/share/venv"
if [ ! -d "$VENV_DIR" ]; then
  uv venv "$VENV_DIR"
fi

packages=(
  psutil
  pynvim
  setuptools
  six
  wheel
)
for p in "${packages[@]}"; do
  uv pip install --python "$VENV_DIR/bin/python" --upgrade "$p"
done

print_success "Python installed!"
