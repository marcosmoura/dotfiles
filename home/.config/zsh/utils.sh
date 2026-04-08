#!/usr/bin/env bash

# Terminal colors (with fallback)
if command -v tput &>/dev/null && [ -t 1 ]; then
  TEXT_YELLOW=$(tput setaf 3)
  TEXT_GREEN=$(tput setaf 2)
  TEXT_BLUE=$(tput setaf 4)
  TEXT_CYAN=$(tput setaf 6)
  TEXT_PURPLE=$(tput setaf 5)
  TEXT_RED=$(tput setaf 1)
  TEXT_RESET=$(tput sgr0)
else
  TEXT_YELLOW="" TEXT_GREEN="" TEXT_BLUE="" TEXT_CYAN=""
  TEXT_PURPLE="" TEXT_RED="" TEXT_RESET=""
fi

export TEXT_SEPARATOR="-----------------------------------------"

print_text() { echo "${TEXT_RESET}${1}${TEXT_RESET}"; }
print_yellow() { print_text "${TEXT_YELLOW}${1}"; }
print_green() { print_text "${TEXT_GREEN}${1}"; }
print_blue() { print_text "${TEXT_BLUE}${1}"; }
print_cyan() { print_text "${TEXT_CYAN}${1}"; }
print_purple() { print_text "${TEXT_PURPLE}${1}"; }
print_red() { print_text "${TEXT_RED}${1}"; }

print_start() { print_text "▶ $1"; }
print_progress() { print_cyan "  → $1"; }
print_info() { print_blue "ℹ️  $1"; }
print_success() { print_green "\n✅ $1"; }
print_error() { print_red "❌ $1"; }

authenticateBeforeUpdate() {
  print_text "🔑 Authenticating"
  sudo -v || {
    print_error "Failed to acquire sudo credentials"
    exit 1
  }

  if [ -n "${SUDO_KEEPALIVE_PID:-}" ] && kill -0 "${SUDO_KEEPALIVE_PID}" 2>/dev/null; then
    return 0
  fi

  local parent_pid=$$

  stop_sudo_keepalive() {
    if [ -n "${SUDO_KEEPALIVE_PID:-}" ] && kill -0 "${SUDO_KEEPALIVE_PID}" 2>/dev/null; then
      kill "${SUDO_KEEPALIVE_PID}" 2>/dev/null || true
    fi
    unset SUDO_KEEPALIVE_PID
  }

  (
    while true; do
      kill -0 "$parent_pid" 2>/dev/null || exit 0
      sudo -n true 2>/dev/null || exit 0
      sleep 60
    done
  ) &
  SUDO_KEEPALIVE_PID=$!

  command -v disown &>/dev/null && disown "$SUDO_KEEPALIVE_PID" 2>/dev/null || true
  trap 'stop_sudo_keepalive' EXIT INT TERM HUP QUIT
}
