#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Dotfiles Installation Utilities
# Shared utility library for ALL install scripts
# =============================================================================

# -----------------------------------------------------------------------------
# Color Variables (with fallback if tput unavailable)
# -----------------------------------------------------------------------------
if command -v tput &>/dev/null && [ -t 1 ]; then
  TEXT_BLUE=$(tput setaf 4)
  TEXT_GREEN=$(tput setaf 2)
  TEXT_YELLOW=$(tput setaf 3)
  TEXT_RED=$(tput setaf 1)
  TEXT_CYAN=$(tput setaf 6)
  TEXT_PURPLE=$(tput setaf 5)
  TEXT_RESET=$(tput sgr0)
else
  TEXT_BLUE=""
  TEXT_GREEN=""
  TEXT_YELLOW=""
  TEXT_RED=""
  TEXT_CYAN=""
  TEXT_PURPLE=""
  TEXT_RESET=""
fi

export TEXT_SEPARATOR="-----------------------------------------"

# -----------------------------------------------------------------------------
# Directory Resolution
# -----------------------------------------------------------------------------
# Resolve DOTFILES_DIR to the repo root (parent of installation/)
if [[ -z "${DOTFILES_DIR:-}" ]]; then
  # Get the directory where this script is located
  _UTILS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # Go up to installation/, then up to repo root
  DOTFILES_DIR="$(cd "${_UTILS_DIR}/../.." && pwd)"
  export DOTFILES_DIR
fi

# SCRIPT_DIR for the current script location
if [[ -z "${SCRIPT_DIR:-}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[1]:-${0}}")" && pwd)"
  export SCRIPT_DIR
fi

# -----------------------------------------------------------------------------
# Logging Functions
# -----------------------------------------------------------------------------
function log_info { printf '%s\n' "${TEXT_BLUE}[i] $1${TEXT_RESET}"; }
function log_success { printf '%s\n' "${TEXT_GREEN}[+] $1${TEXT_RESET}"; }
function log_warn { printf '%s\n' "${TEXT_YELLOW}[!] $1${TEXT_RESET}"; }
function log_error { printf '%s\n' "${TEXT_RED}[x] $1${TEXT_RESET}" >&2; }
function log_step { printf '%s\n' "${TEXT_PURPLE}>>> $1${TEXT_RESET}"; }
function log_progress { printf '%s\n' "${TEXT_CYAN}  > $1${TEXT_RESET}"; }

# -----------------------------------------------------------------------------
# Backward-Compatible Aliases
# -----------------------------------------------------------------------------
function print_start { log_step "$@"; }
function print_progress { log_progress "$@"; }
function print_info { log_info "$@"; }
function print_success { log_success "$@"; }
function print_error { log_error "$@"; }

# -----------------------------------------------------------------------------
# Command Requirements
# -----------------------------------------------------------------------------
function require_command {
  local cmd="$1"
  if ! command -v "$cmd" &>/dev/null; then
    log_error "Required command not found: $cmd"
    return 1
  fi
  return 0
}

# -----------------------------------------------------------------------------

# Retry Logic
# -----------------------------------------------------------------------------
function retry {
  local max_attempts="$1"
  local delay_seconds="$2"
  shift 2
  local attempt=1

  while [[ $attempt -le $max_attempts ]]; do
    if "$@"; then
      return 0
    fi

    log_warn "Command failed (attempt $attempt/$max_attempts): $*"

    if [[ $attempt -lt $max_attempts ]]; then
      log_info "Waiting ${delay_seconds}s before retry..."
      sleep "$delay_seconds"
    fi

    ((attempt++))
  done

  log_error "Command failed after $max_attempts attempts: $*"
  return 1
}

# -----------------------------------------------------------------------------
# Summary Tracking
# -----------------------------------------------------------------------------
_SUMMARY_OK=()
_SUMMARY_SKIP=()
_SUMMARY_FAIL=()

function summary_success {
  _SUMMARY_OK+=("$1")
}

function summary_skip {
  _SUMMARY_SKIP+=("$1")
}

function summary_fail {
  _SUMMARY_FAIL+=("$1")
}

function print_summary {
  echo ""
  echo "$TEXT_SEPARATOR"
  echo "           Installation Summary"
  echo "$TEXT_SEPARATOR"

  if [[ ${#_SUMMARY_OK[@]} -gt 0 ]]; then
    echo ""
    log_success "Completed (${#_SUMMARY_OK[@]}):"
    for item in "${_SUMMARY_OK[@]}"; do
      printf '    + %s\n' "$item"
    done
  fi

  if [[ ${#_SUMMARY_SKIP[@]} -gt 0 ]]; then
    echo ""
    log_warn "Skipped (${#_SUMMARY_SKIP[@]}):"
    for item in "${_SUMMARY_SKIP[@]}"; do
      printf '    - %s\n' "$item"
    done
  fi

  if [[ ${#_SUMMARY_FAIL[@]} -gt 0 ]]; then
    echo ""
    log_error "Failed (${#_SUMMARY_FAIL[@]}):"
    for item in "${_SUMMARY_FAIL[@]}"; do
      printf '    x %s\n' "$item"
    done
  fi

  echo ""
  echo "$TEXT_SEPARATOR"
}

# -----------------------------------------------------------------------------
# Sudo Authentication with Keep-Alive
# -----------------------------------------------------------------------------
_SUDO_KEEPALIVE_PID=""

function authenticate_sudo {
  # Guard against multiple invocations
  if [[ -n "${_SUDO_KEEPALIVE_PID:-}" ]] && kill -0 "$_SUDO_KEEPALIVE_PID" 2>/dev/null; then
    return 0
  fi

  log_step "Authenticating sudo..."

  # Request sudo access
  if ! sudo -v; then
    log_error "Failed to authenticate sudo"
    return 1
  fi

  # Start keep-alive background loop
  (
    while true; do
      sudo -n true 2>/dev/null || exit 0
      sleep 60
    done
  ) &
  _SUDO_KEEPALIVE_PID=$!

  # Expose cleanup function - caller (install.sh) is responsible for trap registration
  _cleanup_sudo() {
    if [[ -n "${_SUDO_KEEPALIVE_PID:-}" ]]; then
      kill "$_SUDO_KEEPALIVE_PID" 2>/dev/null || true
      wait "$_SUDO_KEEPALIVE_PID" 2>/dev/null || true
      _SUDO_KEEPALIVE_PID=""
    fi
  }

  log_success "Sudo authenticated with keep-alive"
  return 0
}
