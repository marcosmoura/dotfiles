#!/bin/sh

printMsg "BREW" "Installing casks..."

# Browsers
brew cask install firefox-nightly
brew cask install google-chrome-canary

# Development
brew cask install android-ndk
brew cask install android-sdk
brew cask install android-studio-preview
brew cask install figma
brew cask install imageoptim
brew cask install iterm2-nightly
brew cask install java8
brew cask install jetbrains-toolbox
brew cask install reactotron
brew cask install visual-studio-code-insiders
brew cask install zeplin

# Communication
brew cask install franz

# Cloud
brew cask install google-backup-and-sync

# Games
brew cask install league-of-legends
brew cask install steam

# Productivity
brew cask install alfred
brew cask install hammerspoon
brew cask install kap
brew cask install slowquitapps
brew cask install spectacle

# Media
brew cask install mplayerx
brew cask install spotify
brew cask install spotmenu
brew cask install subtitle-master
brew cask install transmission
brew cask install vlc

# Quicklook extensions
brew cask install qlcolorcode
brew cask install qlimagesize
brew cask install qlmarkdown
brew cask install qlstephen
brew cask install qlvideo
brew cask install quicklook-json
brew cask install quicklookase
brew cask install suspicious-package
brew cask install webpquicklook

# Fonts
brew cask install font-fira-code
brew cask install font-hack
brew cask install font-hack-nerd-font

# Other
brew cask install android-file-transfer
brew cask install appcleaner
brew cask install captin
brew cask install caption
brew cask install clover-configurator
brew cask install flux
brew cask install hwsensors
brew cask install monity-helper
brew cask install notion
brew cask install shifty
brew cask install the-unarchiver
brew cask install typora
brew cask install unified-remote

printSuccess "BREW" "Installed with success..."

printMsg "MAC APPS" "Installing App Store Apps..."

mas install 948176063 # Boom 2
mas install 915542151 # Monity
mas install 495945638 # Wake Up Time
mas install 497799835 # Xcode

printSuccess "MAC APPS" "Installed with success..."
