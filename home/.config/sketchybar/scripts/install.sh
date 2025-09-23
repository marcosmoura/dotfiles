#!/usr/bin/env bash

set -euo pipefail

REPO_URL="https://github.com/FelixKratz/SbarLua.git"
REPO_DIR="$HOME/.cache/SbarLua"

# clone if missing, otherwise fetch & update
if [ ! -d "$REPO_DIR/.git" ]; then
	mkdir -p "$(dirname "$REPO_DIR")"
	git clone "$REPO_URL" "$REPO_DIR"

	# run install from the repo
	make -C "$REPO_DIR" install
else
	git -C "$REPO_DIR" fetch --all --prune >/dev/null
	# remember current HEAD (empty if no commits yet)
	old_head=$(git -C "$REPO_DIR" rev-parse --verify HEAD 2>/dev/null || true)

	# try a fast-forward pull, fall back to rebase if needed
	if ! git -C "$REPO_DIR" pull --ff-only >/dev/null; then
		git -C "$REPO_DIR" pull --rebase >/dev/null
	fi

	# determine new HEAD and run install only if it changed
	new_head=$(git -C "$REPO_DIR" rev-parse --verify HEAD 2>/dev/null || true)
	if [ "$old_head" != "$new_head" ]; then
		make -C "$REPO_DIR" install
	fi
fi
