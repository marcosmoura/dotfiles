print_start "Installing applications"

print_progress "OS utilities\n"

brew install --no-quarantine --cask captin
brew install --no-quarantine --cask hammerspoon
defaults write org.hammerspoon.Hammerspoon MJConfigFile "~/.config/hammerspoon/init.lua"
brew install --no-quarantine --cask hiddenbar
brew install --no-quarantine --cask keepingyouawake
brew install --no-quarantine --cask stats
brew install --no-quarantine --cask the-unarchiver
mas install 497799835 # Xcode

print_progress "Communication\n"

brew install --no-quarantine --cask discord
brew install --no-quarantine --cask whatsapp

print_text ""
print_progress "Keyboard Tools\n"

brew install --cask qmk-toolbox
brew install --cask via

print_progress "Productivity\n"

brew install --no-quarantine --cask google-drive
brew install --no-quarantine --cask kap
brew install --no-quarantine --cask notion
brew install --no-quarantine --cask raycast
brew install --no-quarantine --cask shottr

print_progress "Browsers\n"

brew install --no-quarantine --cask firefox-nightly
brew install --no-quarantine --cask google-chrome-canary
brew install --no-quarantine --cask orion

print_progress "Dev Tools\n"

brew install --no-quarantine --cask figma
brew install --no-quarantine --cask imageoptim
brew install --no-quarantine --cask sf-symbols
brew install --no-quarantine --cask visual-studio-code
brew install --no-quarantine --cask wezterm

print_progress "Media\n"

brew install --no-quarantine --cask spotify
brew install --no-quarantine --cask transmission
brew install --no-quarantine --cask vlc

print_progress "Others\n"

brew install --no-quarantine --cask adguard
brew install nextdns/tap/nextdns
brew install --no-quarantine --cask appcleaner
mas install 1294126402 # HEIC converter
mas install 1596706466 # Speediness
mas install 1611378436 # Pure Paste

print_progress "Cleaning up\n"

brew cleanup

print_success "All apps installed! \n"
