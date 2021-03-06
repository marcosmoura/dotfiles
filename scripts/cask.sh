#!/bin/sh

reset
printMsg "BREW" "Installing casks..."

# Browsers
brew install --no-quarantine firefox-nightly
brew install --no-quarantine google-chrome-canary

# Development
brew install --no-quarantine figma
brew install --no-quarantine imageoptim
brew install --no-quarantine inkscape
brew install --no-quarantine iterm2
brew install --no-quarantine sf-symbols
brew install --no-quarantine visual-studio-code-insiders
brew install --no-quarantine zeplin

# Fonts
brew install --no-quarantine font-cascadia-mono
brew install --no-quarantine font-fira-code
brew install --no-quarantine font-hack-nerd-font
brew install --no-quarantine font-jetbrains-mono

# Communication
brew install --no-quarantine discord
brew install --no-quarantine whatsapp
brew install --no-quarantine zoom

# Cloud
brew install --no-quarantine google-backup-and-sync

# Games
brew install --no-quarantine steam

# Productivity
brew install --no-quarantine alfred
brew install --no-quarantine bitwarden
brew install --no-quarantine hammerspoon
brew install --no-quarantine hiddenbar
brew install --no-quarantine kap
brew install --no-quarantine keeper-password-manager
brew install --no-quarantine koekeishiya/formulae/yabai
brew install --no-quarantine muzzle
brew install --no-quarantine numi

# Media
brew install --no-quarantine audio-hijack
brew install --no-quarantine iina
brew install --no-quarantine spotify
brew install --no-quarantine subtitle-master
brew install --no-quarantine transmission
brew install --no-quarantine vlc

# Quicklook extensions
brew install --no-quarantine qlcolorcode
brew install --no-quarantine qlimagesize
brew install --no-quarantine qlmarkdown
brew install --no-quarantine qlstephen
brew install --no-quarantine qlvideo
brew install --no-quarantine quicklook-json
brew install --no-quarantine quicklookase
brew install --no-quarantine webpquicklook

# Other
brew install --no-quarantine adguard
brew install --no-quarantine appcleaner
brew install --no-quarantine captin
brew install --no-quarantine caption
brew install --no-quarantine lyricsx
brew install --no-quarantine mullvadvpn
brew install --no-quarantine notion
brew install --no-quarantine opencore-configurator
brew install --no-quarantine shifty
brew install --no-quarantine the-unarchiver

printSuccess "BREW" "Installed with success..."

printMsg "MAC APPS" "Installing App Store Apps..."

mas install 1319778037 # iStats Menu
mas install 497799835  # Xcode
mas install 948176063  # Boom 2

printSuccess "MAC APPS" "Installed with success..."
