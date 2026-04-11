#!/usr/bin/env bash
set -euo pipefail

# install_sbarlua.sh
# Compile and install SbarLua for sketchybar Lua plugin support.
# This script is idempotent -- it will skip installation if the shared
# object already exists at the expected location.

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

SBAR_LUA_DIR="$HOME/.local/share/sketchybar_lua"
BUILD_DIR="${TMPDIR:-/tmp}/SbarLua"

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    return 1
  fi
}

if [ -f "$SBAR_LUA_DIR/sketchybar.so" ]; then
  return 0
fi

require_command git || return 1
require_command make || return 1

echo "Installing SbarLua..."
mkdir -p "$SBAR_LUA_DIR"

rm -rf "$BUILD_DIR"

if ! git clone https://github.com/FelixKratz/SbarLua.git "$BUILD_DIR"; then
  echo "Failed to clone SbarLua." >&2
  return 1
fi

if ! make -C "$BUILD_DIR" install; then
  rm -rf "$BUILD_DIR"
  echo "Failed to build or install SbarLua." >&2
  return 1
fi

rm -rf "$BUILD_DIR"

if [ ! -f "$SBAR_LUA_DIR/sketchybar.so" ]; then
  echo "SbarLua install completed, but $SBAR_LUA_DIR/sketchybar.so is still missing." >&2
  return 1
fi

echo "SbarLua installed."
return 0
