#!/bin/sh

# Check for homebrew and install if needed
printMsg "HOMEBREW" "Installing..."

which -s brew
if [[ $? != 0 ]] ; then
  yes | /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
else
  printSuccess "HOMEBREW" "Already installed..."
fi

printMsg "BREW" "Tapping repositories..."

brew tap buo/cask-upgrade
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
brew upgrade --force-bottle --cleanup

printSuccess "HOMEBREW" "Installing packages..."

# GNU core utilities
brew install coreutils
brew install findutils
brew install moreutils

# Install development tools
brew install cocoapods
brew install dart
brew install go
brew install ideviceinstaller
brew install ios-deploy
brew install lua
brew install node
brew install perl
brew install python
brew install python@2
brew install rbenv
brew install ruby
brew install watchman
brew install yarn

# Install more recent versions of some OS X tools.
brew install grep --with-default-names

# Install terminal tools
brew install bash
brew install exa
brew install getantibody/tap/antibody
brew install gnu-sed
brew install ncurses
brew install ngrep
brew install openssh
brew install openssl
brew install terminal-notifier
brew install thefuck
brew install tree
brew install z
brew install zsh

# Git
brew install diff-so-fancy
brew install git

# Other
brew install curl
brew install mas
brew install neofetch
brew install neovim
brew install speedtest-cli
brew install vim
brew install wget

brew cleanup
brew prune

printSuccess "HOMEBREW" "Installed with success..."
