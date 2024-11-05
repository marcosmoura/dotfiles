alias echo="echo -e"

# Text
TEXT_YELLOW=$(tput setaf 3)
TEXT_GREEN=$(tput setaf 2)
TEXT_BLUE=$(tput setaf 6)
TEXT_PURPLE=$(tput setaf 5)
TEXT_RED=$(tput setaf 1)
TEXT_RESET=$(tput sgr0)
export TEXT_SEPARATOR="-----------------------------------------------------------"

# Colors
function print_text {
  echo "$TEXT_RESET$1$TEXT_RESET"
}

function print_yellow {
  print_text "$TEXT_YELLOW$1$TEXT_RESET"
}

function print_green {
  print_text "$TEXT_GREEN$1$TEXT_RESET"
}

function print_blue {
  print_text "$TEXT_BLUE$1$TEXT_RESET"
}

function print_purple {
  print_text "$TEXT_PURPLE$1$TEXT_RESET"
}

function print_red {
  print_text "$TEXT_RED$1$TEXT_RESET"
}

# Modes
function print_start {
  print_text "🆕 $1"
  print_text "$TEXT_SEPARATOR"
}

function print_progress {
  print_text "\n🏃 $1\n"
}

function print_info {
  print_blue "ℹ️  $1"
}

function print_success {
  print_green "\n✅ $1"
}

function print_error {
  print_red "❌ $1"
}

# Functions
function join_by_char {
  local d=${1-} f=${2-}

  if shift 2; then
    printf %s "$f" "${@/#/$d}"
  fi
}

function authenticateBeforeUpdate {
  print_text "🔑 Authenticating"
  print_text "$TEXT_SEPARATOR\n"
  sudo -v

  # Keep-alive: update existing `sudo` time stamp until `.osx` has finished
  while true; do
    sudo -n true
    sleep 60
    kill -0 "$$" || exit
  done 2>/dev/null &
}

function is_macos {
  [[ "$OSTYPE" == "darwin"* ]]
}

function is_linux {
  [[ "$OSTYPE" == "linux-gnu"* ]]
}

function is_wsl {
  [[ $(uname -r) =~ WSL ]]
}

function install_app {
  local app_name=$1

  if is_macos; then
    brew install --no-quarantine $app_name
  elif is_linux; then
    yay -S $app_name --noconfirm --needed
  fi
}

function install_apps {
  local apps=("$@")

  if is_macos; then
    brew install --no-quarantine "${apps[@]}"
  elif is_linux; then
    yay -S "${apps[@]}" --noconfirm --needed
  fi
}
