#!/usr/bin/env zsh

print_start "Installing Homebrew\n"

which -s brew
if [[ $? != 0 ]]; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

eval "$(/opt/homebrew/bin/brew shellenv)"

print_progress "Updating brew\n"

brew tap dteoh/sqa
brew tap FelixKratz/formulae
brew tap githubutilities/tap
brew tap homebrew/cask
brew tap homebrew/cask-drivers
brew tap homebrew/cask-fonts
brew tap homebrew/cask-versions
brew tap homebrew/core
brew tap homebrew/services

brew -v update
brew upgrade

brew install aerospace
brew install aom
brew install bandwhich
brew install bash
brew install bat
brew install boost
brew install borders
brew install bottom
brew install bun
brew install camdencheek/brew/fre
brew install chafa
brew install cmake
brew install cocoapods
brew install code-minimap
brew install colorscript
brew install coreutils
brew install curl
brew install deno
brew install direnv
brew install dust
brew install edencommon
brew install eth-p/software/bat-extras
brew install fastfetch
brew install fb303
brew install fbthrift
brew install fd
brew install ffmpeg
brew install ffmpegthumbnailer
brew install findutils
brew install fizz
brew install folly
brew install fx
brew install fzf
brew install gawk
brew install gcc
brew install gh
brew install git
brew install git-delete-merged-branches
brew install git-delta
brew install glow
brew install gnu-sed
brew install gnupg
brew install gnutls
brew install go
brew install gpgme
brew install grep
brew install hyperfine
brew install jpeg-xl
brew install jq
brew install jstkdng/programs/ueberzugpp
brew install koekeishiya/formulae/yabai
brew install lazygit
brew install libarchive
brew install libgit2
brew install librist
brew install llvm
brew install llvm@16
brew install lpeg
brew install lua
brew install lua-language-server
brew install luajit
brew install luarocks
brew install marcosmoura/homebrew-tap/tsv-utils
brew install mas
brew install mise
brew install moreutils
brew install navi
brew install ncdu
brew install ncurses
brew install neovim
brew install nextdns
brew install nnn
brew install node
brew install node@18
brew install node@20
brew install openblas
brew install openjpeg
brew install openssl@3
brew install openvino
brew install osx-cpu-temp
brew install perl
brew install pillow
brew install pipx
brew install pnpm
brew install poppler
brew install python-packaging
brew install rbenv
brew install ripgrep
brew install rust
brew install rustup
brew install sheldon
brew install shellcheck
brew install shfmt
brew install starship
brew install tealdeer
brew install terminal-notifier
brew install tmux
brew install tokei
brew install topgrade
brew install tree
brew install tree-sitter
brew install tsv-utils
brew install unar
brew install unbound
brew install viu
brew install vivid
brew install wallpaper
brew install wangle
brew install watchman
brew install webp
brew install yarn
brew install yazi
brew install zellij
brew install zoxide
brew install zsh

print_text ""
print_progress "Installing applications"

brew install --cask --no-quarantine adguard
brew install --cask --no-quarantine appcleaner
brew install --cask --no-quarantine arc
brew install --cask --no-quarantine cursor
brew install --cask --no-quarantine discord
brew install --cask --no-quarantine displaylink
brew install --cask --no-quarantine figma
brew install --cask --no-quarantine firefox-nightly
brew install --cask --no-quarantine font-cozette
brew install --cask --no-quarantine font-fira-code
brew install --cask --no-quarantine font-hanken-grotesk
brew install --cask --no-quarantine font-inter
brew install --cask --no-quarantine font-jetbrains-mono
brew install --cask --no-quarantine font-maple-mono
brew install --cask --no-quarantine font-sf-mono
brew install --cask --no-quarantine font-symbols-only-nerd-font
brew install --cask --no-quarantine ghostty
brew install --cask --no-quarantine hammerspoon
brew install --cask --no-quarantine imageoptim
brew install --cask --no-quarantine jordanbaird-ice
brew install --cask --no-quarantine kap
brew install --cask --no-quarantine keka
brew install --cask --no-quarantine kekaexternalhelper
brew install --cask --no-quarantine linearmouse
brew install --cask --no-quarantine logitech-camera-settings
brew install --cask --no-quarantine microsoft-auto-update
brew install --cask --no-quarantine microsoft-outlook
brew install --cask --no-quarantine microsoft-remote-desktop
brew install --cask --no-quarantine microsoft-teams
brew install --cask --no-quarantine pearcleaner
brew install --cask --no-quarantine proton-drive
brew install --cask --no-quarantine proton-pass
brew install --cask --no-quarantine protonvpn
brew install --cask --no-quarantine proxy-audio-device
brew install --cask --no-quarantine qlcolorcode
brew install --cask --no-quarantine qlimagesize
brew install --cask --no-quarantine qlmarkdown
brew install --cask --no-quarantine qlstephen
brew install --cask --no-quarantine qlvideo
brew install --cask --no-quarantine quicklook-json
brew install --cask --no-quarantine quicklookase
brew install --cask --no-quarantine raycast
brew install --cask --no-quarantine sf-symbols
brew install --cask --no-quarantine shottr
brew install --cask --no-quarantine spotify
brew install --cask --no-quarantine stats
brew install --cask --no-quarantine visual-studio-code
brew install --cask --no-quarantine vlc
brew install --cask --no-quarantine webpquicklook
brew install --cask --no-quarantine whatsapp@beta
brew install --cask --no-quarantine zoom
mas install 497799835 # Xcode

print_text ""
print_progress "Cleaning up\n"

defaults write org.hammerspoon.Hammerspoon MJConfigFile "~/.config/hammerspoon/init.lua"
brew cleanup

print_text ""
print_success "Homebrew installed! \n"
