#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Pre-Install Script
# Authenticates sudo and installs Xcode Command Line Tools
# =============================================================================

# Source utils if not already loaded
if ! command -v log_step &>/dev/null; then
  # shellcheck source=/dev/null
  source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../lib" && pwd)/utils.sh"
fi

log_step "Pre-installation setup..."

# -----------------------------------------------------------------------------
# Sudo Authentication
# -----------------------------------------------------------------------------
authenticate_sudo
summary_success "Sudo authenticated"

# -----------------------------------------------------------------------------
# Xcode Command Line Tools
# -----------------------------------------------------------------------------
log_progress "Checking Xcode Command Line Tools..."

if ! xcode-select -p &>/dev/null; then
  log_info "Installing Xcode Command Line Tools..."

  # Trigger installation
  xcode-select --install

  # Wait for installation to complete
  log_info "Waiting for Xcode Command Line Tools installation..."
  log_info "(Click 'Install' in the dialog that appears)"

  until xcode-select -p &>/dev/null; do
    sleep 5
  done

  log_success "Xcode Command Line Tools installed"
  summary_success "Xcode Command Line Tools"
else
  log_info "Xcode Command Line Tools already installed"
  summary_success "Xcode Command Line Tools (already present)"
fi
