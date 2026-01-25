# Sheldon
eval "$(sheldon completions --shell zsh)" >/dev/null 2>&1

# FZF
source <(fzf --zsh) >/dev/null 2>&1

# Atuin
export ATUIN_NOBIND="true"
eval "$(atuin init zsh)" >/dev/null 2>&1

bindkey '^r' atuin-up-search
bindkey '^R' atuin-search

# Stache completions
eval "$(stache completions --shell zsh)" >/dev/null 2>&1
