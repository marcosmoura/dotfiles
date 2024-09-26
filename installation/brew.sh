#!/usr/bin/env zsh

print_start "Installing Homebrew\n"

which -s brew
if [[ $? != 0 ]]; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

eval "$(/opt/homebrew/bin/brew shellenv)"

print_progress "Updating brew\n"

brew -v update
brew upgrade --force-bottle

print_text ""
print_progress "Tapping repositories\n"

brew tap dteoh/sqa
brew tap FelixKratz/formulae
brew tap githubutilities/tap
brew tap homebrew/cask
brew tap homebrew/cask-drivers
brew tap homebrew/cask-fonts
brew tap homebrew/cask-versions
brew tap homebrew/core
brew tap homebrew/services

print_text ""
print_progress "Core utilities\n"

brew install bash
brew install cmake
brew install coreutils
brew install findutils
brew install gawk
brew install grep
brew install moreutils
brew install ncurses
brew install openssl

print_text ""
print_progress "Programming languages\n"

brew install --cask flutter
brew install deno
brew install go
brew install lua
brew install luarocks
brew install perl

print_text ""
print_progress "Programming tools\n"

brew install cocoapods
brew install direnv
brew install watchman

print_text ""
print_progress "Terminal tools\n"

brew install bat
brew install bottom
brew install camdencheek/brew/fre
brew install dust
brew install eth-p/software/bat-extras
brew install eza
brew install fd
brew install ffmpegthumbnailer
brew install fx
brew install fzf
brew install git
brew install git-delete-merged-branches
brew install git-delta
brew install glow
brew install gnu-sed
brew install hyperfine
brew install jq
brew install macchina
brew install marcosmoura/homebrew-tap/tsv-utils
brew install navi
brew install ncdu
brew install nvim
brew install poppler
brew install shellcheck
brew install shfmt
brew install starship
brew install tealdeer
brew install terminal-notifier
brew install tree
brew install unar
brew install vivid
brew install yazi
brew install zellij
brew install zoxide

print_text ""
print_progress "Terminal apps\n"
brew install --cask nikitabobko/tap/aerospace
brew install bandwhich
brew install koekeishiya/formulae/skhd
brew install koekeishiya/formulae/yabai
brew install mas
brew install osx-cpu-temp
brew install sketchybar
brew install tokei

print_text ""
print_progress "Fonts\n"

brew install --cask font-fira-code
brew install --cask font-inter
brew install --cask font-jetbrains-mono
brew install --cask font-maple
brew install --cask font-symbols-only-nerd-font

print_text ""
print_progress "QuickLook extensions\n"

brew install --no-quarantine qlcolorcode
brew install --no-quarantine qlimagesize
brew install --no-quarantine qlmarkdown
brew install --no-quarantine qlstephen
brew install --no-quarantine qlvideo
brew install --no-quarantine quicklook-json
brew install --no-quarantine quicklookase
brew install --no-quarantine webpquicklook

print_text ""
print_progress "Cleaning up\n"

brew cleanup

print_text ""
print_success "Homebrew installed! \n"
