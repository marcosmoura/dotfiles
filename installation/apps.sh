print_start "Installing applications"

package_manager=""

if is_macos; then
  package_manager="Homebrew and mas"
elif is_linux; then
  package_manager="Yay"
fi

print_progress "All apps will be installed using the package manager of your system.\n \
  The package manager used is $TEXT_BLUE$package_manager$TEXT_RESET.\n"

APPS=(
  # OS utilities
  "bash"
  "coreutils"
  "findutils"
  "gawk"
  "grep"
  "moreutils"
  "ncurses"
  "openssl"

  # Programming languages and tools
  "deno"
  "go"
  "lua"
  "luarocks"
  "npm"
  "perl"
  "pnpm"
  "python"
  "rbenv"
  "ruby-build"
  "yarn"

  # Terminal tools
  "bat"
  "bottom"
  "dust"
  "eza"
  "fd"
  "ffmpegthumbnailer"
  "fx"
  "fzf"
  "git-delete-merged-branches"
  "git-delta"
  "git"
  "glow"
  "hyperfine"
  "jq"
  "macchina"
  "navi"
  "ncdu"
  "neovim"
  "poppler"
  "sheldon"
  "shellcheck"
  "shfmt"
  "starship"
  "tealdeer"
  "tree"
  "vivid"
  "yazi"
  "zellij"
  "zsh"
  "zoxide"

  # Terminal apps
  "bandwhich"
  "tokei"
)

if ! is_wsl; then
  APPS+=(
    # Desktop apps
    "discord"
    "firefox-nightly"
    "inkscape"
    "notion"
    "spotify"
    "vlc"
    "wezterm"
  )
fi

if is_macos; then
  APPS+=(
    # OS utilities
    "gnu-sed"
    "cmake"

    # Programming languages and tools
    "cocoapods"
    "node"
    "rustup-init"

    # Terminal tools
    "eth-p/software/bat-extras"
    "terminal-notifier"
    "unar"

    # Terminal apps
    "mas"
    "nextdns/tap/nextdns"
    "osx-cpu-temp"

    # Apps
    "nikitabobko/tap/aerospace"
    "sketchybar"

    # Fonts
    "font-fira-code"
    "font-inter"
    "font-jetbrains-mono"
    "font-maple"
    "font-symbols-only-nerd-font"

    # Quick Look plugins
    "qlcolorcode"
    "qlimagesize"
    "qlmarkdown"
    "qlstephen"
    "qlvideo"
    "quicklook-json"
    "quicklookase"
    "webpquicklook"

    # Desktop apps
    "adguard"
    "appcleaner"
    "captin"
    "caption"
    "displaperture"
    "figma"
    "flipper"
    "google-chrome-canary"
    "hiddenbar"
    "iina"
    "imageoptim"
    "kap"
    "keepingyouawake"
    "onyx"
    "phoenix"
    "qmk-toolbox"
    "raycast"
    "sf-symbols"
    "shottr"
    "stats"
    "the-unarchiver"
    "topnotch"
    "transmission"
    "turbo-boost-switcher"
    "via"
    "visual-studio-code"
    "whatsapp"
  )

  mas install 1294126402 # HEIC converter
  mas install 1596706466 # Speediness
  mas install 1611378436 # Pure Paste
  mas install 497799835  # Xcode
fi

if is_linux; then
  APPS+=(
    # Programming languages and tools
    "nodejs"
    "python-pip"
    "rustup"

    # Terminal tools
    "bat-extras"

    # Fonts
    "ttf-fira-code"
    "ttf-inter"
    "ttf-jetbrains-mono"
    "ttf-maple"
    "ttf-nerd-fonts-symbols"
  )

  if ! is_wsl; then
    APPS+=(
      # Desktop apps
      "google-chrome-dev"
      "nextdns"
      "transmission-gtk"
      "visual-studio-code-bin"
      "whatsie"
    )
  fi
fi

install_apps "${APPS[@]}"

print_success "All apps installed! \n"

# TODO: Add Winget apps
# Winget apps
# "7zip.7zip"
# "AdGuard.AdGuard"
# "Cockos.REAPER"
# "Daum.PotPlayer"
# "Discord.Discord"
# "FACEITLTD.FACEITAC"
# "Google.Chrome"
# "JamesCJ60.Universalx86TuningUtility"
# "Logitech.CameraSettings"
# "Microsoft.PowerShell"
# "Microsoft.PowerToys"
# "NextDNS.NextDNS.Desktop"
# "Notion.Notion"
# "Proton.ProtonDrive"
# "Proton.ProtonPass"
# "Proton.ProtonVPN"
# "TheBrowserCompany.Arc"
