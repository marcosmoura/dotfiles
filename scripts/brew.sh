#!/bin/sh

# Check for homebrew and install if needed
reset
printMsg "HOMEBREW" "Installing..."

which -s brew
if [[ $? != 0 ]] ; then
  yes | /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
else
  printSuccess "HOMEBREW" "Already installed..."
fi

printMsg "BREW" "Tapping repositories..."

brew tap dart-lang/dart
brew tap dteoh/sqa
brew tap githubutilities/tap
brew tap homebrew/cask
brew tap homebrew/cask-drivers
brew tap homebrew/cask-fonts
brew tap homebrew/cask-versions
brew tap homebrew/core
brew tap homebrew/services

brew -v update
brew upgrade --force-bottle
brew cleanup

printSuccess "HOMEBREW" "Installing packages..."

# GNU core utilities
brew install coreutils
brew install findutils
brew install moreutils

# Install development tools
brew install dart
brew install deno
brew install dust
brew install fx
brew install fzf
brew install glow
brew install go
brew install lua
brew install node
brew install perl
brew install python
brew install python@2
brew install rbenv
brew install ruby
brew install rust
brew install rustup-init
brew install watchman
brew install yarn

# Install more recent versions of some OS X tools.
brew install grep --with-default-names

# Install terminal tools
brew install bandwhich
brew install bash
brew install bat
brew install eth-p/software/bat-extras
brew install exa
brew install fd
brew install getantibody/tap/antibody
brew install git-delta
brew install gnu-sed
brew install ncdu
brew install ncurses
brew install ngrep
brew install openssh
brew install openssl
brew install osx-cpu-temp
brew install starship
brew install terminal-notifier
brew install thefuck
brew install tokei
brew install tree
brew install vivid
brew install zoxide
brew install zsh

# Git
brew install diff-so-fancy
brew install git

# Other
brew install curl
brew install liquidctl
brew install mas
brew install neofetch
brew install neovim
brew install speedtest-cli
brew install tldr
brew install vim
brew install wget

brew cleanup

printSuccess "HOMEBREW" "Installed with success..."
