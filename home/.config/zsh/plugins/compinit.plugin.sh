#!/usr/bin/env bash

# Load completions with caching for faster startup
# Only regenerate dump once per day
autoload -Uz compinit >/dev/null 2>&1

# Use -C to skip compaudit security check (saves ~20ms)
# Use cached completions if dump file exists and is less than 24h old
_comp_path="${ZDOTDIR:-$HOME}/.zcompdump"
if [[ -f "$_comp_path" ]]; then
	# Check if zcompdump needs refresh (older than 24 hours)
	if [[ $(date +'%j') != $(date -r "$_comp_path" +'%j' 2>/dev/null) ]]; then
		compinit -C -d "$_comp_path" >/dev/null 2>&1
		# Async compile zcompdump for faster loading next time
		zsh-defer -c "zcompile '$_comp_path' 2>/dev/null" >/dev/null 2>&1
	else
		compinit -C -d "$_comp_path" >/dev/null 2>&1
	fi
else
	compinit -d "$_comp_path" >/dev/null 2>&1
	zsh-defer -c "zcompile '$_comp_path' 2>/dev/null"
fi
unset _comp_path
