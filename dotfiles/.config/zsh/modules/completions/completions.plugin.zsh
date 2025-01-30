# FZF
source <(fzf --zsh)

# Luarocks
eval "$(luarocks path)"

# Rust
source $HOME/.cargo/env

# Ruby
export RBENV_VERSION=$(rbenv install -l -s | grep -v - | tail -1)
eval "$(rbenv init - zsh)"
rbenv global $RBENV_VERSION

# Sheldon
eval "$(sheldon completions --shell zsh)"
