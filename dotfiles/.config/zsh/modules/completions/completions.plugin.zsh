# FZF
source <(fzf --zsh)

# Direnv
eval "$(direnv hook zsh)"

# Luarocks
eval "$(luarocks path)"

# GH
eval "$(gh completion -s zsh)"
eval "$(gh copilot alias zsh)"
alias cop=ghcs
alias cop-e=ghce
