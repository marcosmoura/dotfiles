#!/usr/bin/env bash

print_start "Installing Homebrew"

if ! command -v brew >/dev/null 2>&1; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

eval "$(/opt/homebrew/bin/brew shellenv)"

print_progress "Updating brew"

brew update
brew upgrade

print_progress "Installing command-line tools (formulas)"

brew tap FelixKratz/formulae
brew tap githubutilities/tap

formulas=(
  atuin
  bash
  bat
  btop
  chafa
  cmake
  cocoapods
  coreutils
  curl
  deno
  direnv
  docker-compose
  dust
  efm-langserver
  eth-p/software/bat-extras
  fastfetch
  fd
  findutils
  fx
  fzf
  gawk
  gcc
  gh
  git
  git-delete-merged-branches
  git-delta
  git-lfs
  gnu-sed
  gnutls
  go
  grep
  jq
  lazygit
  lolcat
  mas
  mise
  moreutils
  narugit/tap/smctemp
  gdu
  ncurses
  neovim
  nextdns/tap/nextdns
  ninja
  openssl
  pandoc
  perl
  pre-commit
  ripgrep
  rust-analyzer
  shellcheck
  speedtest
  starship
  taplo
  tealdeer
  terminal-notifier
  topgrade
  tree
  tree-sitter
  tsv-utils
  unar
  vivid
  wallpaper
  watchman
  webp
  wget
  yaml-language-server
  yazi
  yq
  zig
  zoxide
)

install_from_head=(
  borders
  media-control
)

# Install formulas idempotently
for f in "${formulas[@]}"; do
  if ! brew list --versions "$f" >/dev/null 2>&1; then
    brew install "$f"
  fi
done

for f in "${install_from_head[@]}"; do
  if ! brew list --versions "$f" >/dev/null 2>&1; then
    brew install --HEAD "$f"
  fi
done

print_progress "Installing applications (casks)"

casks=(
  adguard
  BarutSRB/tap/hyprspace
  displaylink
  figma
  firefox-nightly
  font-fira-code
  font-hack-nerd-font
  font-hanken-grotesk
  font-inter
  font-jetbrains-mono
  font-maple-mono-nf
  font-sf-mono
  font-symbols-only-nerd-font
  ghostty
  git-credential-manager
  intune-company-portal
  jordanbaird-ice
  kap
  keka
  kekaexternalhelper
  leader-key
  linearmouse
  logitech-camera-settings
  microsoft-auto-update
  microsoft-edge@dev
  microsoft-outlook
  microsoft-teams
  obs
  orbstack
  pearcleaner
  powershell
  proton-drive
  proton-pass
  protonvpn
  proxy-audio-device
  raycast
  sf-symbols
  shottr
  spotify
  stats
  visual-studio-code
  whatsapp
  zoom
)
for c in "${casks[@]}"; do
  if ! brew list --cask --versions "$c" >/dev/null 2>&1; then
    brew install --cask --no-quarantine "$c"
  fi
done

if command -v mas >/dev/null 2>&1 && ! mas list | grep -q "497799835"; then
  mas install 497799835 # Xcode
fi

print_success "Homebrew installed!"
