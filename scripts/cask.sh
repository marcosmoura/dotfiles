#!/bin/sh

reset
printMsg "BREW" "Installing casks..."

# Browsers
brew cask install --no-quarantine firefox-nightly
brew cask install --no-quarantine google-chrome-canary

# Development
brew cask install --no-quarantine figma
brew cask install --no-quarantine hyper
brew cask install --no-quarantine imageoptim
brew cask install --no-quarantine iterm2
brew cask install --no-quarantine visual-studio-code-insiders
brew cask install --no-quarantine zeplin

# Communication
brew cask install --no-quarantine discord
brew cask install --no-quarantine whatsapp

# Cloud
brew cask install --no-quarantine google-backup-and-sync

# Games
brew cask install --no-quarantine steam

# Productivity
brew cask install --no-quarantine alfred
brew cask install --no-quarantine hammerspoon
brew cask install --no-quarantine hiddenbar
brew cask install --no-quarantine kap
brew cask install --no-quarantine koekeishiya/formulae/yabai
brew cask install --no-quarantine muzzle
brew cask install --no-quarantine numi

# Media
brew cask install --no-quarantine iina
brew cask install --no-quarantine spotify
brew cask install --no-quarantine subtitle-master
brew cask install --no-quarantine transmission
brew cask install --no-quarantine vlc

# Quicklook extensions
brew cask install --no-quarantine qlcolorcode
brew cask install --no-quarantine qlimagesize
brew cask install --no-quarantine qlmarkdown
brew cask install --no-quarantine qlstephen
brew cask install --no-quarantine qlvideo
brew cask install --no-quarantine quicklook-json
brew cask install --no-quarantine quicklookase
brew cask install --no-quarantine suspicious-package
brew cask install --no-quarantine webpquicklook

# Fonts
brew cask install --no-quarantine font-cascadia-mono
brew cask install --no-quarantine font-fira-code
brew cask install --no-quarantine font-hack
brew cask install --no-quarantine font-hack-nerd-font
brew cask install --no-quarantine font-jetbrains-mono

# Other
brew cask install --no-quarantine adguard
brew cask install --no-quarantine android-file-transfer
brew cask install --no-quarantine appcleaner
brew cask install --no-quarantine captin
brew cask install --no-quarantine caption
brew cask install --no-quarantine lyricsx
brew cask install --no-quarantine mullvadvpn
brew cask install --no-quarantine notion
brew cask install --no-quarantine opencore-configurator
brew cask install --no-quarantine shifty
brew cask install --no-quarantine the-unarchiver

printSuccess "BREW" "Installed with success..."

printMsg "MAC APPS" "Installing App Store Apps..."

mas install 1319778037 # iStats Menu
mas install 497799835  # Xcode
mas install 948176063  # Boom 2
mas install 980888073  # Crypto Pro

printSuccess "MAC APPS" "Installed with success..."
