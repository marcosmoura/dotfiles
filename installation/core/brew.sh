#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Homebrew Installation Script
# Installs Homebrew, updates, and runs bundle
# =============================================================================

# Source utils if not already loaded
if ! command -v log_step &>/dev/null; then
  # shellcheck source=/dev/null
  source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../lib" && pwd)/utils.sh"
fi

log_step "Setting up Homebrew..."

# -----------------------------------------------------------------------------
# Setup Homebrew environment (always needed, even in dry-run)
# -----------------------------------------------------------------------------
if [[ -f /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [[ -f /usr/local/bin/brew ]]; then
  eval "$(/usr/local/bin/brew shellenv)"
fi

dry_run_guard "Homebrew" "Would install/update Homebrew, run brew bundle, cleanup" && return 0

# Install Homebrew if not present
if ! command -v brew &>/dev/null; then
  log_info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  log_success "Homebrew installed"
else
  log_info "Homebrew already installed"
fi

# Update and upgrade
log_progress "Updating Homebrew..."
brew update
brew upgrade || true

# Install Rosetta (for Apple Silicon Macs)
if [[ "$(uname -m)" == "arm64" ]]; then
  log_progress "Installing Rosetta 2..."
  sudo softwareupdate --install-rosetta --agree-to-license || true
fi

# Brew Bundle
BREWFILE="$DOTFILES_DIR/home/Brewfile"
if [[ -f "$BREWFILE" ]]; then
  log_progress "Installing packages from Brewfile..."
  retry 2 5 brew bundle --file="$BREWFILE"
  log_warn "Removing Homebrew packages not in Brewfile..."
  brew bundle cleanup --file="$BREWFILE" --force || true
else
  log_warn "Brewfile not found at: $BREWFILE"
fi

# Cleanup
log_progress "Cleaning up..."
brew cleanup || true

summary_success "Homebrew packages installed"
