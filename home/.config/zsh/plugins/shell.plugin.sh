#!/usr/bin/env bash

# Set 256 color terminal
export TERM=xterm-256color
export CATPPUCCIN_COLORS=$(cat ~/.config/zsh/static/catppuccin-colors.txt)
export LS_COLORS=$CATPPUCCIN_COLORS

# Open zsh config
alias dotfiles="code ~/Projects/dotfiles"

# Open zsh config
alias zshconfig="code ~/.zshrc"

# Always enable colored `grep` output
# Note: `GREP_OPTIONS="--color=auto"` is deprecated, hence the alias usage.
alias grep='grep --color=auto'
alias fgrep='fgrep --color=auto'
alias egrep='egrep --color=auto'

# sudo editors
alias vim='nvim'
alias svim='sudo nvim'
alias snano='sudo nano'

# Better du
alias du='dust -x -X .git -X node_modules'

# Better man
alias help='tldr'
alias man='batman'

# Chmod -x
alias chmox='chmod -x'

# Trim trailing newline and copy to clipboard
alias copy="tr -d '\n' | pbcopy"

# Better FZF
export FZF_DEFAULT_OPTS=" \
--color=fg:#cdd6f4,header:#f38ba8,info:#cba6f7,pointer:#f5e0dc,gutter:-1 \
--color=marker:#b4befe,fg+:#cdd6f4,prompt:#cba6f7,hl+:#f38ba8 \
--color=selected-bg:#45475a \
--multi"

# FZF with unique list filtering
function fzfu() {
	awk '!x[$0]++' | fzf
}

# Better tree
alias tree="tree --gitignore --dirsfirst --sort name -C"

# Create a .tar.gz archive, using `zopfli`, `pigz` or `gzip` for compression
function targz() {
	local tmpFile="${@%/}.tar"
	tar -cvf "${tmpFile}" --exclude=".DS_Store" "${@}" || return 1

	size=$(
		stat -f"%z" "${tmpFile}" 2>/dev/null # OS X `stat`
		stat -c"%s" "${tmpFile}" 2>/dev/null # GNU `stat`
	)

	local cmd=""
	if ((size < 52428800)) && hash zopfli 2>/dev/null; then
		# the .tar file is smaller than 50 MB and Zopfli is available; use it
		cmd="zopfli"
	else
		if hash pigz 2>/dev/null; then
			cmd="pigz"
		else
			cmd="gzip"
		fi
	fi

	echo "Compressing .tar using \`${cmd}\`…"
	"${cmd}" -v "${tmpFile}" || return 1
	[ -f "${tmpFile}" ] && rm "${tmpFile}"
	echo "${tmpFile}.gz created successfully."
}

# Reload shell
function reload() {
	exec $SHELL -l
}
