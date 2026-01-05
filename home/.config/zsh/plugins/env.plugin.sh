#!/usr/bin/env bash

# Rust - already loaded in .zshenv, skip if PATH already contains cargo
if [[ ! "$PATH" == *".cargo/bin"* ]]; then
	source $HOME/.cargo/env
fi

# Ruby
RBENV_VERSION_CACHE="$HOME/.cache/rbenv_version"
RBENV_VERSION_CACHE_TTL=86400 # 1 day in seconds

if [[ -f "$RBENV_VERSION_CACHE" ]]; then
	CACHE_AGE=$(($(date +%s) - $(stat -f %m "$RBENV_VERSION_CACHE" 2>/dev/null || stat -c %Y "$RBENV_VERSION_CACHE" 2>/dev/null)))
	if [[ $CACHE_AGE -gt $RBENV_VERSION_CACHE_TTL ]]; then
		export RBENV_VERSION=$(rbenv install -l -s | grep -v - | tail -1)
		echo "$RBENV_VERSION" >"$RBENV_VERSION_CACHE"
	else
		export RBENV_VERSION=$(cat "$RBENV_VERSION_CACHE")
	fi
else
	mkdir -p "$(dirname "$RBENV_VERSION_CACHE")"
	export RBENV_VERSION=$(rbenv install -l -s | grep -v - | tail -1)
	echo "$RBENV_VERSION" >"$RBENV_VERSION_CACHE"
fi
eval "$(rbenv init - zsh)" >/dev/null 2>&1

# Luarocks - defer to avoid blocking startup
eval "$(luarocks path)"

# SSH Agent - only start if not already running
if [[ -z "$(pgrep -u $USER ssh-agent)" ]]; then
	eval "$(ssh-agent -s)"
fi
