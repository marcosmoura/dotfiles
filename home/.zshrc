# .zshrc: interactive shells.
#
# Only what the first prompt needs loads here. Completion, tool integrations
# and plugins load right after the prompt is on screen, in the order that
# ~/.config/sheldon/plugins.toml lists them.

ZSH_DIR=${XDG_CONFIG_HOME:-$HOME/.config}/zsh

source $ZSH_DIR/lib/cache.zsh # `cached`: keeps the code that tools generate on disk
source $ZSH_DIR/lib/print.zsh # print-* helpers

source $ZSH_DIR/rc/options.zsh
source $ZSH_DIR/rc/history.zsh
source $ZSH_DIR/rc/secrets.zsh # API keys from ~/.secrets
source $ZSH_DIR/rc/aliases.zsh
source $ZSH_DIR/rc/herdr.zsh   # pane titles inside Herdr
source $ZSH_DIR/rc/prompt.zsh  # starship
source $ZSH_DIR/rc/plugins.zsh # key bindings now, everything else deferred

# Each file in functions/ is a command that loads the first time it runs
fpath=($ZSH_DIR/functions $fpath)
autoload -Uz $ZSH_DIR/functions/*(N.:t)

# Welcome screen in login shells, which is what a new terminal tab starts
if [[ -o login ]]; then
  print -n '\e[H\e[2J\e[3J' # clear the screen and the scrollback
  system-info
fi

# bun completions
# Loaded on the first tab, by ~/.config/zsh/completions/_bun. The line above
# has to stay as it is: `bun upgrade` looks for it, and appends its own loader
# to this file when it is missing.
