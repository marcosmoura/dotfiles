TEXT_YELLOW=$(tput setaf 3)
TEXT_GREEN=$(tput setaf 2)
TEXT_BLUE=$(tput setaf 6)
TEXT_PURPLE=$(tput setaf 5)
TEXT_RED=$(tput setaf 1)
TEXT_RESET=$(tput sgr0)
TEXT_SEPARATOR="-----------------------------------------"

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
}

function print_progress {
  print_text "🏃 $1"
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
