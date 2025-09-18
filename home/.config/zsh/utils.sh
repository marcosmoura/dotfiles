#!/usr/bin/env bash

TEXT_YELLOW=$(tput setaf 3)
TEXT_GREEN=$(tput setaf 2)
TEXT_BLUE=$(tput setaf 4)
TEXT_CYAN=$(tput setaf 6)
TEXT_PURPLE=$(tput setaf 5)
TEXT_RED=$(tput setaf 1)
TEXT_RESET=$(tput sgr0)
export TEXT_SEPARATOR="-----------------------------------------"

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

function print_cyan {
  print_text "$TEXT_CYAN$1$TEXT_RESET"
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

function authenticateBeforeUpdate {
  print_text "🔑 Authenticating"
  sudo -v || {
    print_error "Failed to acquire sudo credentials"
    exit 1
  }

  print_text ""
  # Avoid spawning multiple keep-alive loops if already running in this shell.
  if [ -n "${SUDO_KEEPALIVE_PID:-}" ] && kill -0 "${SUDO_KEEPALIVE_PID}" 2>/dev/null; then
    return 0
  fi

  local parent_pid=$$

  # Define a cleanup function (idempotent) so we can reuse in traps or manual calls.
  stop_sudo_keepalive() {
    if [ -n "${SUDO_KEEPALIVE_PID:-}" ] && kill -0 "${SUDO_KEEPALIVE_PID}" 2>/dev/null; then
      kill "${SUDO_KEEPALIVE_PID}" 2>/dev/null || true
    fi
    unset SUDO_KEEPALIVE_PID
  }

  # Background keep-alive loop: refresh sudo timestamp every 60s while parent shell lives.
  (
    while true; do
      # Exit if parent shell died (prevents orphan after sourced subshell exits).
      if ! kill -0 "$parent_pid" 2>/dev/null; then
        exit 0
      fi
      sudo -n true 2>/dev/null || exit 0
      sleep 60
    done
  ) &
  SUDO_KEEPALIVE_PID=$!

  # Detach from job control if possible to suppress shell job messages.
  if command -v disown >/dev/null 2>&1; then
    disown "$SUDO_KEEPALIVE_PID" 2>/dev/null || true
  fi

  # Ensure cleanup on common termination signals. Use a single trap preserving existing ones is complex;
  # here we overwrite (acceptable in this context). If integration with other traps needed, merge logic.
  trap 'stop_sudo_keepalive' EXIT INT TERM HUP QUIT
}
