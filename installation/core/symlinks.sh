#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Symlinks Management Script
# Creates symlinks from home/ to $HOME, with dry-run and backup support
# =============================================================================

# Source utils if not already loaded
if ! command -v log_step &>/dev/null; then
  # shellcheck source=/dev/null
  source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../lib" && pwd)/utils.sh"
fi

log_step "Setting up symlinks..."

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
DOTFILES_DRY_RUN="${DOTFILES_DRY_RUN:-0}"
DOTFILES_SYMLINK_BACKUP="${DOTFILES_SYMLINK_BACKUP:-0}"

HOME_DIR="$HOME"
SOURCE_DIR="$DOTFILES_DIR/home"
DRY_RUN_DIR="$DOTFILES_DIR/.cache/dry-run"

# Tracking arrays
_CREATED_SYMLINKS=()
_REMOVED_SYMLINKS=()
_BACKED_UP=()

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------

function resolve_path {
  local path="$1"

  # Try grealpath first (GNU coreutils on macOS)
  if command -v grealpath &>/dev/null; then
    grealpath -m "$path"
    return 0
  fi

  # Try python3 fallback
  if command -v python3 &>/dev/null; then
    python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$path"
    return 0
  fi

  # Last resort: readlink
  if command -v readlink &>/dev/null; then
    readlink -m "$path" 2>/dev/null || echo "$path"
    return 0
  fi

  # Ultimate fallback
  echo "$path"
}

function safe_remove {
  local target="$1"
  local force_recursive="${2:-0}"

  if [[ "$DOTFILES_DRY_RUN" == "1" ]]; then
    log_info "[DRY RUN] Would remove: $target"
    return 0
  fi

  if [[ -L "$target" ]]; then
    rm -f "$target"
  elif [[ -f "$target" ]]; then
    rm -f "$target"
  elif [[ -d "$target" ]]; then
    if [[ "$force_recursive" == "1" ]]; then
      log_warn "Removing existing directory: $target"
      rm -rf "$target"
    # Only remove empty directories to avoid nuking user data
    elif [[ -z "$(ls -A "$target" 2>/dev/null)" ]]; then
      rmdir "$target" 2>/dev/null || true
    else
      log_warn "Skipping non-empty directory: $target"
      return 1
    fi
  fi
}

function backup_existing {
  local target="$1"

  if [[ ! -e "$target" && ! -L "$target" ]]; then
    return 0
  fi

  if [[ "$DOTFILES_SYMLINK_BACKUP" != "1" ]]; then
    return 0
  fi

  local backup_suffix=".backup.$(date +%Y%m%d_%H%M%S)"
  local backup_path="${target}${backup_suffix}"

  if [[ "$DOTFILES_DRY_RUN" == "1" ]]; then
    log_info "[DRY RUN] Would backup: $target -> $backup_path"
    return 0
  fi

  mv "$target" "$backup_path"
  _BACKED_UP+=("$target -> $backup_path")
  log_info "Backed up: $target"
}

function create_symlink {
  local source="$1"
  local target="$2"
  local force_recursive_remove=0

  if [[ "$(basename "$target")" == ".config" ]]; then
    force_recursive_remove=1
  fi

  # Determine actual target based on dry-run mode
  local actual_target
  if [[ "$DOTFILES_DRY_RUN" == "1" ]]; then
    # Create relative path from home inside dry-run dir
    local rel_path="${target#$HOME/}"
    actual_target="$DRY_RUN_DIR/$rel_path"
    mkdir -p "$(dirname "$actual_target")"
  else
    actual_target="$target"
  fi

  # Backup or remove existing target
  if [[ -e "$actual_target" || -L "$actual_target" ]]; then
    if [[ "$DOTFILES_SYMLINK_BACKUP" == "1" ]]; then
      backup_existing "$actual_target"
    else
      if ! safe_remove "$actual_target" "$force_recursive_remove"; then
        log_error "Cannot create symlink — target exists and could not be removed: $actual_target"
        summary_fail "Symlink: $(basename "$target")"
        return 0
      fi
    fi
  fi

  # Create the symlink (in dry-run, symlinks go into .cache/dry-run/ for inspection)
  ln -snf "$source" "$actual_target"

  if [[ "$DOTFILES_DRY_RUN" == "1" ]]; then
    log_info "[DRY RUN] Created in sandbox: $actual_target -> $source"
  fi

  _CREATED_SYMLINKS+=("$actual_target -> $source")
  log_progress "Linked: $(basename "$target")"
}

# -----------------------------------------------------------------------------
# Stale Symlink Cleanup
# -----------------------------------------------------------------------------

function cleanup_stale_symlinks {
  log_progress "Checking for stale symlinks..."

  local found_stale=0

  # Check top-level entries in $HOME
  for entry in "$HOME_DIR"/* "$HOME_DIR"/.*; do
    [[ "$entry" == "$HOME_DIR/*" || "$entry" == "$HOME_DIR/.*" ]] && continue
    [[ "$entry" == "$HOME_DIR/." || "$entry" == "$HOME_DIR/.." ]] && continue

    if [[ -L "$entry" ]]; then
      local target
      target=$(readlink "$entry") || continue

      # Check if it points into our dotfiles
      if [[ "$target" == "$SOURCE_DIR"/* ]]; then
        # Check if target still exists
        if [[ ! -e "$target" ]]; then
          log_warn "Removing stale symlink: $entry -> $target"

          if [[ "$DOTFILES_DRY_RUN" == "1" ]]; then
            log_info "[DRY RUN] Would remove: $entry"
          else
            rm "$entry"
          fi

          _REMOVED_SYMLINKS+=("$entry")
          ((found_stale++)) || true
        fi
      fi
    fi
  done

  # Check inside ~/.config/
  if [[ -d "$HOME_DIR/.config" ]]; then
    while IFS= read -r -d '' entry; do
      if [[ -L "$entry" ]]; then
        local target
        target=$(readlink "$entry") || continue

        # Check if it points into our dotfiles
        if [[ "$target" == "$SOURCE_DIR"/* ]]; then
          # Check if target still exists
          if [[ ! -e "$target" ]]; then
            log_warn "Removing stale symlink: $entry -> $target"

            if [[ "$DOTFILES_DRY_RUN" == "1" ]]; then
              log_info "[DRY RUN] Would remove: $entry"
            else
              rm "$entry"
            fi

            _REMOVED_SYMLINKS+=("$entry")
            ((found_stale++)) || true
          fi
        fi
      fi
    done < <(find "$HOME_DIR/.config" -type l -print0 2>/dev/null || true)
  fi

  if [[ $found_stale -gt 0 ]]; then
    log_info "Removed $found_stale stale symlink(s)"
  else
    log_info "No stale symlinks found"
  fi
}

# -----------------------------------------------------------------------------
# Main Symlink Creation
# -----------------------------------------------------------------------------

function create_all_symlinks {
  # Enable dotglob to include hidden files
  shopt -s dotglob

  # Ensure source directory exists
  if [[ ! -d "$SOURCE_DIR" ]]; then
    log_error "Source directory not found: $SOURCE_DIR"
    return 1
  fi

  # Create dry-run directory if needed
  if [[ "$DOTFILES_DRY_RUN" == "1" ]]; then
    mkdir -p "$DRY_RUN_DIR"
    log_warn "Dry-run mode: symlinks will be created in $DRY_RUN_DIR"
  fi

  # Walk home/ directory (dotglob is enabled, so * already matches dotfiles)
  for entry in "$SOURCE_DIR"/*; do
    # Skip non-existent entries (from glob expansion)
    [[ ! -e "$entry" ]] && continue

    local basename_entry
    basename_entry=$(basename "$entry")

    # Skip special entries
    [[ "$basename_entry" == "." || "$basename_entry" == ".." ]] && continue

    # SSH config is managed outside the repo (~/.ssh/config) — skip if present
    [[ "$basename_entry" == ".ssh-config" ]] && continue

    # Regular symlink: ~/entry -> DOTFILES_DIR/home/entry
    create_symlink "$entry" "$HOME_DIR/$basename_entry"
  done

  shopt -u dotglob
}

# -----------------------------------------------------------------------------
# Execute
# -----------------------------------------------------------------------------

create_all_symlinks
cleanup_stale_symlinks

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------

echo ""
if [[ ${#_CREATED_SYMLINKS[@]} -gt 0 ]]; then
  log_success "Created ${#_CREATED_SYMLINKS[@]} symlink(s)"
fi

if [[ ${#_REMOVED_SYMLINKS[@]} -gt 0 ]]; then
  log_info "Removed ${#_REMOVED_SYMLINKS[@]} stale symlink(s)"
fi

if [[ ${#_BACKED_UP[@]} -gt 0 ]]; then
  log_info "Backed up ${#_BACKED_UP[@]} existing file(s)"
fi

summary_success "Symlinks configured"
