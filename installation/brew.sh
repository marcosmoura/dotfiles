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
  cloc
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
  exiftool
  eza
  fastfetch
  fd
  findutils
  fx
  fzf
  gawk
  gcc
  gdu
  gh
  git
  git-delete-merged-branches
  git-delta
  git-lfs
  gnu-sed
  gnuplot
  gnutls
  go
  grep
  hyperfine
  imageoptim-cli
  jq
  lazygit
  lolcat
  mas
  mise
  mole
  moreutils
  narugit/tap/smctemp
  ncurses
  neovim
  nextdns/tap/nextdns
  ninja
  ollama
  opencode
  openssl
  osx-cpu-temp
  pandoc
  perl
  pipx
  pre-commit
  ripgrep
  rust-analyzer
  rustup
  sheldon
  shellcheck
  shfmt
  speedtest
  speedtest-cli
  starship
  taplo
  tealdeer
  terminal-notifier
  topgrade
  tree
  tree-sitter
  tsv-utils
  unar
  uv
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
  betterdisplay
  claude-code
  discord
  displaylink
  figma
  firefox-nightly
  font-commit-mono
  font-fira-code
  font-hanken-grotesk
  font-inter
  font-jetbrains-mono
  font-maple-mono-nf
  font-sf-mono
  font-symbols-only-nerd-font
  ghostty
  git-credential-manager
  imageoptim
  intune-company-portal
  kap
  keka
  kekaexternalhelper
  linearmouse
  logitech-camera-settings
  microsoft-auto-update
  microsoft-edge@dev
  microsoft-outlook
  microsoft-teams
  ollama-app
  orbstack
  pearcleaner
  proton-drive
  proton-pass
  protonvpn
  proxy-audio-device
  raycast
  sf-symbols
  shottr
  spotify
  tidal
  visual-studio-code
  whatsapp
  zoom
)
for c in "${casks[@]}"; do
  if ! brew list --cask --versions "$c" >/dev/null 2>&1; then
    brew install --cask "$c"
  fi
done

if command -v mas >/dev/null 2>&1 && ! mas list | grep -q "497799835"; then
  mas install 497799835 # Xcode
fi

print_success "Homebrew installed!"
