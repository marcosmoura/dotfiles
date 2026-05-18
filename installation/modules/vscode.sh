#!/usr/bin/env bash
set -euo pipefail

if ! command -v log_step &>/dev/null; then
  source "${DOTFILES_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}/installation/lib/utils.sh"
fi

log_step "Installing VS Code extensions"

require_command pnpm || return 1

VSCODE_EXT_DIR="$HOME/.vscode/extensions"
SOURCE_DIR="$DOTFILES_DIR/tools/opencode-launcher"
TARGET_LINK="$VSCODE_EXT_DIR/opencode-launcher"

if [[ ! -d "$SOURCE_DIR" ]]; then
  log_error "Source directory not found: $SOURCE_DIR"
  summary_fail "VS Code extensions"
  return 1
fi

log_progress "Creating VS Code extensions directory"
mkdir -p "$VSCODE_EXT_DIR"

log_progress "Symlinking opencode-launcher extension"
if [[ -L "$TARGET_LINK" ]]; then
  rm -rf "$TARGET_LINK"
elif [[ -e "$TARGET_LINK" ]]; then
  backup_path="${TARGET_LINK}.backup.$(date +%Y%m%d_%H%M%S)"
  log_warn "Backing up existing path: $TARGET_LINK"
  mv "$TARGET_LINK" "$backup_path"
fi
ln -sf "$SOURCE_DIR" "$TARGET_LINK"

log_progress "Installing extension dependencies"
if [[ -f "$SOURCE_DIR/pnpm-lock.yaml" ]]; then
  (cd "$SOURCE_DIR" && pnpm install --frozen-lockfile) || {
    log_error "Failed to install dependencies (frozen lockfile)"
    summary_fail "VS Code extensions"
    return 1
  }
else
  (cd "$SOURCE_DIR" && pnpm install) || {
    log_error "Failed to install dependencies"
    summary_fail "VS Code extensions"
    return 1
  }
fi

log_progress "Type-checking extension"
(cd "$SOURCE_DIR" && pnpm typecheck) || {
  log_error "Failed to type-check extension"
  summary_fail "VS Code extensions"
  return 1
}

log_progress "Building extension"
(cd "$SOURCE_DIR" && pnpm build) || {
  log_error "Failed to build extension"
  summary_fail "VS Code extensions"
  return 1
}

log_success "VS Code extensions installed"
summary_success "VS Code extensions"
