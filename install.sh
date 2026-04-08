#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Dotfiles Installation Entry Point
# =============================================================================

# Determine SCRIPT_DIR and set DOTFILES_DIR before sourcing utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DOTFILES_DIR="$SCRIPT_DIR"
source "$SCRIPT_DIR/installation/lib/utils.sh"

# -----------------------------------------------------------------------------
# CLI Flag Parsing
# -----------------------------------------------------------------------------
RUN_CORE=false
RUN_ALL=false
RUN_MODULES=()
AVAILABLE_MODULES=(zsh node lua python ruby rust)

# Dry-run is CLI-only. Do not inherit it from the parent shell environment.
DOTFILES_DRY_RUN=0
export DOTFILES_DRY_RUN

function show_usage {
  local modules_list="${AVAILABLE_MODULES[*]}"
  cat <<EOF
Usage: $0 [OPTIONS]

Options:
  --all              Run core + all modules
  --core             Run core scripts only
  --module <name>    Run specific module(s) (can be used multiple times)
  --dry-run          Enable dry-run mode (simulate changes)
  --help             Show this help message

Available modules: $modules_list

Examples:
  $0 --all                    # Run everything
  $0 --core                   # Run only core scripts
  $0 --module zsh --module node  # Run specific modules
  $0 --dry-run --all          # Dry run everything
EOF
}

# Parse arguments — no flags shows help
if [[ $# -eq 0 ]]; then
  show_usage
  exit 0
else
  while [[ $# -gt 0 ]]; do
    case "$1" in
    --all)
      RUN_ALL=true
      shift
      ;;
    --core)
      RUN_CORE=true
      shift
      ;;
    --module)
      shift
      while [[ $# -gt 0 ]] && [[ "$1" != --* ]]; do
        RUN_MODULES+=("$1")
        shift
      done
      ;;
    --dry-run)
      DOTFILES_DRY_RUN=1
      export DOTFILES_DRY_RUN
      shift
      ;;
    --help)
      show_usage
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      show_usage
      exit 1
      ;;
    esac
  done
fi

# Require at least one action flag
if [[ "$RUN_CORE" == false && "$RUN_ALL" == false && ${#RUN_MODULES[@]} -eq 0 ]]; then
  log_error "No action specified. Use --all, --core, or --module <name>."
  show_usage
  exit 1
fi

# -----------------------------------------------------------------------------
# Banner
# -----------------------------------------------------------------------------
echo "$TEXT_SEPARATOR"
echo "        Marcos Moura Dotfiles"
echo "$TEXT_SEPARATOR"
echo ""

if [[ "$DOTFILES_DRY_RUN" == "1" ]]; then
  log_warn "DRY RUN MODE - Symlinks go to .cache/dry-run/; brew, modules, and macOS are log-only"
  echo ""
fi

# -----------------------------------------------------------------------------
# Core Scripts (always run in order)
# -----------------------------------------------------------------------------
CORE_SCRIPTS=(preinstall brew symlinks macos)

function run_core_scripts {
  log_step "Running core installation scripts..."
  for script in "${CORE_SCRIPTS[@]}"; do
    local script_path="$DOTFILES_DIR/installation/core/${script}.sh"
    if [[ -f "$script_path" ]]; then
      log_progress "Loading: $script"
      # shellcheck source=/dev/null
      source "$script_path"
    else
      log_error "Core script not found: $script_path"
      summary_fail "Core script: $script"
    fi
  done
}

# -----------------------------------------------------------------------------
# Git Identity Setup
# -----------------------------------------------------------------------------
function setup_git_identity {
  # Write into the repo so it lands at ~/.config/git/identity after symlinks
  local identity_file="$DOTFILES_DIR/home/.config/git/identity"

  if [[ -f "$identity_file" ]]; then
    log_info "Git identity already configured, skipping."
    return 0
  fi

  log_step "Setting up Git identity..."

  local name email
  echo -n "Enter your Git name: "
  read -r name
  echo -n "Enter your Git email: "
  read -r email

  if [[ -z "$name" || -z "$email" ]]; then
    log_warn "Git identity not configured (empty input)"
    summary_skip "Git identity setup"
    return 0
  fi

  mkdir -p "$(dirname "$identity_file")"
  cat >"$identity_file" <<EOF
[user]
  name = $name
  email = $email
EOF

  log_success "Git identity configured"
  summary_success "Git identity setup"
}

# -----------------------------------------------------------------------------
# Module Scripts
# -----------------------------------------------------------------------------
function run_module {
  local module="$1"
  local script_path="$DOTFILES_DIR/installation/modules/${module}.sh"

  if [[ ! -f "$script_path" ]]; then
    log_error "Module not found: $module"
    summary_fail "Module: $module"
    return 1
  fi

  log_progress "Loading module: $module"
  # shellcheck source=/dev/null
  source "$script_path"
}

function run_all_modules {
  log_step "Running all modules..."
  for module in "${AVAILABLE_MODULES[@]}"; do
    run_module "$module"
  done
}

function run_selected_modules {
  log_step "Running selected modules..."
  for module in "${RUN_MODULES[@]}"; do
    run_module "$module"
  done
}

# -----------------------------------------------------------------------------
# Post-Install (always runs)
# -----------------------------------------------------------------------------
function run_postinstall {
  local script_path="$DOTFILES_DIR/installation/core/postinstall.sh"
  if [[ -f "$script_path" ]]; then
    log_step "Running post-install..."
    # shellcheck source=/dev/null
    source "$script_path"
  fi
}

# -----------------------------------------------------------------------------
# Composed EXIT handler (summary + sudo cleanup)
# -----------------------------------------------------------------------------
_install_cleanup() {
  print_summary
  command -v _cleanup_sudo &>/dev/null && _cleanup_sudo
}
trap '_install_cleanup' EXIT

# -----------------------------------------------------------------------------
# Main Execution
# -----------------------------------------------------------------------------

# Run core scripts if requested
if [[ "$RUN_ALL" == true || "$RUN_CORE" == true ]]; then
  run_core_scripts

  # Setup git identity after symlinks
  setup_git_identity || true
fi

# Run modules if requested
if [[ "$RUN_ALL" == true ]]; then
  run_all_modules
elif [[ ${#RUN_MODULES[@]} -gt 0 ]]; then
  run_selected_modules
fi

# Post-install always runs
run_postinstall

# -----------------------------------------------------------------------------
# Completion
# -----------------------------------------------------------------------------

# Create secrets directory if it doesn't exist
if [[ ! -d "$HOME/.secrets" ]]; then
  mkdir -p "$HOME/.secrets"
  chmod 700 "$HOME/.secrets"
  log_info "Created ~/.secrets/ — populate it with your API keys"
fi

# Print summary and disable the EXIT trap (prevent double-print)
print_summary
trap - EXIT

echo ""
log_success "Installation complete!"
echo ""

# Reload shell (skip in dry-run to stay in current session)
if [[ "$DOTFILES_DRY_RUN" != "1" ]]; then
  exec "$SHELL" -l
fi
