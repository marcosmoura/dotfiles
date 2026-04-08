#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Post-Install Script
# Final cleanup and summary
# =============================================================================

# Source utils if not already loaded
if ! command -v log_step &>/dev/null; then
  # shellcheck source=/dev/null
  source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../lib" && pwd)/utils.sh"
fi

log_step "Running post-install cleanup..."

# -----------------------------------------------------------------------------
# Homebrew Cleanup
# -----------------------------------------------------------------------------
if command -v brew &>/dev/null; then
  log_progress "Cleaning up Homebrew..."
  run_or_log brew cleanup || true
fi

# -----------------------------------------------------------------------------
# Software Updates
# -----------------------------------------------------------------------------
log_progress "Checking for software updates..."
run_or_log sudo softwareupdate -i -a || true

# -----------------------------------------------------------------------------
# Reset Terminal Theme
# -----------------------------------------------------------------------------
if command -v fast-theme &>/dev/null; then
  log_progress "Resetting terminal theme..."
  run_or_log fast-theme "${XDG_CONFIG_HOME:-$HOME/.config}/syntax-theme/syntax-theme.ini" || true
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
summary_success "Post-install cleanup complete"

# Note: print_summary is called by install.sh's EXIT trap, not here.
# This avoids double-printing when sourced from install.sh.
