# Setup oh-my-zsh
export ZSH_CACHE_DIR=$HOME/.zsh
export ZSH="$(antibody home)/https-COLON--SLASH--SLASH-github.com-SLASH-robbyrussell-SLASH-oh-my-zsh"

ZSH_THEME=""
ENABLE_CORRECTION="false"
COMPLETION_WAITING_DOTS="false"
HIST_STAMPS="dd/mm/yyyy"

# Call Oh My ZSH
source $ZSH/oh-my-zsh.sh
source $HOME/.zsh_plugins.sh

# Load aliases and functions
source $HOME/.zsh_aliases
source $HOME/.zsh_functions

# Fuck!
eval "$(thefuck --alias)"

# rbenv
eval "$(rbenv init -)"
export RBENV_VERSION=2.6.5

# Path
export PATH=/usr/local/sbin:$PATH
export PATH=/usr/local/bin:$PATH
export PATH=$HOME/.rbenv/shims:$PATH
export PATH="$(yarn global bin):$PATH"

# Preferred editor for local and remote sessions
export EDITOR="nvim"

# Prefer US English and use UTF-8.
export LANG="en_US.UTF-8";
export LC_ALL="en_US.UTF-8";

# Highlight section titles in manual pages.
export LESS_TERMCAP_md="${yellow}";

# Don’t clear the screen after quitting a manual page.
export MANPAGER="less -X";

# Add config folder
export XDG_CONFIG_HOME="$HOME/.config"

# Call SSH files
export SSH_KEY_PATH="$HOME/.ssh/id_rsa"

# Terminal with 256 colors
TERM=xterm-256color
export LS_COLORS="no=00:fi=00:di=01;34:ln=01;36:pi=40;33:so=01;35:do=01;35:bd=40;33;01:cd=40;33;01:or=40;31;01:ex=01;32:*.tar=01;31:*.tgz=01;31:*.arj=01;31:*.taz=01;31:*.lzh=01;31:*.zip=01;31:*.z=01;31:*.Z=01;31:*.gz=01;31:*.bz2=01;31:*.deb=01;31:*.rpm=01;31:*.jar=01;31:*.jpg=01;35:*.jpeg=01;35:*.gif=01;35:*.bmp=01;35:*.pbm=01;35:*.pgm=01;35:*.ppm=01;35:*.tga=01;35:*.xbm=01;35:*.xpm=01;35:*.tif=01;35:*.tiff=01;35:*.png=01;35:*.mov=01;35:*.mpg=01;35:*.mpeg=01;35:*.avi=01;35:*.fli=01;35:*.gl=01;35:*.dl=01;35:*.xcf=01;35:*.xwd=01;35:*.ogg=01;35:*.mp3=01;35:*.wav=01;35:"

# Load Pure Prompt
autoload -U compinit && compinit
autoload -U promptinit; promptinit
prompt pure
export PURE_PROMPT_SYMBOL="%F{green}❯"
export PURE_GIT_DOWN_ARROW="%F{blue}▾"
export PURE_GIT_UP_ARROW="%F{green}▴"
