#!/usr/bin/env bash
# Build script for glass (sketchybar-top) - converted from Makefile

set -euo pipefail

# Default locations (can be overridden via environment variables)
TOP=${TOP:-"$HOME/.config/sketchybar-top"}
BOTTOM=${BOTTOM:-"$HOME/.config/sketchybar-bottom"}

SRC="$TOP/glass/init.lua"
DEST_DIR="$BOTTOM/glass"
DEST="$DEST_DIR/init.lua"

# Check if source file exists
if [ ! -f "$SRC" ]; then
	echo "Error: Source init.lua not found at $SRC" >&2
	exit 1
fi

echo "Creating $DEST_DIR and symlinking init.lua"

# Remove existing directory/symlink if it exists
if [ -e "$DEST_DIR" ]; then
	echo "Removing existing $DEST_DIR if it is a symlink or directory"
	rm -rf "$DEST_DIR"
fi

# Create destination directory and symlink
mkdir -p "$DEST_DIR"
ln -sf "$SRC" "$DEST"

echo "Symlink created: $DEST -> $SRC"
