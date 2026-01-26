#!/usr/bin/env bash

# Catppuccin colors for LS
export CATPPUCCIN_COLORS=$(cat ~/.config/zsh/static/catppuccin-colors.txt)
export LS_COLORS=$CATPPUCCIN_COLORS

# Open zsh config
alias dotfiles="code ~/Projects/dotfiles"

# Open zsh config
alias zshconfig="code ~/.zshrc"

# Always enable colored `grep` output with sensible excludes
# Note: `GREP_OPTIONS="--color=auto"` is deprecated, hence the alias usage.
alias grep='grep --color=auto --exclude-dir={.bzr,CVS,.git,.hg,.svn,.idea,.tox,.venv,venv,node_modules}'
alias egrep='grep -E'
alias fgrep='grep -F'

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

# Better FZF with Catppuccin colors and preview enhancements
export FZF_DEFAULT_COMMAND='fd --type f --hidden --follow --exclude .git'
export FZF_DEFAULT_OPTS=" \
--color=fg:#cdd6f4,bg:#1e1e2e,hl:#f38ba8 \
--color=fg+:#cdd6f4,bg+:#313244,hl+:#f38ba8 \
--color=info:#cba6f7,prompt:#cba6f7,pointer:#f5e0dc \
--color=marker:#b4befe,spinner:#f5e0dc,header:#f38ba8 \
--color=gutter:#1e1e2e,border:#89b4fa \
--height=40% --layout=reverse --border=rounded \
--bind='ctrl-/:toggle-preview' \
--multi"
export FZF_CTRL_T_OPTS="--preview 'bat --style=numbers --color=always {} 2>/dev/null || cat {}'"
export FZF_ALT_C_OPTS="--preview 'eza --tree --color=always {} 2>/dev/null | head -100'"

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
