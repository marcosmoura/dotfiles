#!/usr/bin/env bash

# Environment variables:
#   DOTFILES_SYMLINK_DRY_RUN=1   Show planned changes without applying
#   DOTFILES_SYMLINK_BACKUP=1     Move existing path to *.bak.<timestamp> before linking

print_start "Linking dotfiles"

DRY_RUN=${DOTFILES_SYMLINK_DRY_RUN:-0}
DO_BACKUP=${DOTFILES_SYMLINK_BACKUP:-1}
TIMESTAMP=$(date +%Y%m%d%H%M%S)

resolve_path() {
  if command -v grealpath >/dev/null 2>&1; then
    grealpath "$1"
  else
    # Fallback: use python realpath if coreutils not yet installed
    python3 -c 'import os,sys;print(os.path.realpath(sys.argv[1]))' "$1" 2>/dev/null || readlink "$1"
  fi
}

safe_remove() {
  # Intentionally conservative: only remove if it's a regular file or symlink
  local target="$1"
  if [ -L "$target" ] || [ -f "$target" ]; then
    [ "$DRY_RUN" = "1" ] && {
      echo "DRY-RUN remove $target"
      return 0
    }
    rm -f "$target" 2>/dev/null || true
  elif [ -d "$target" ]; then
    # Only remove empty directories (avoid nuking user data)
    if [ -z "$(ls -A "$target" 2>/dev/null)" ]; then
      [ "$DRY_RUN" = "1" ] && {
        echo "DRY-RUN rmdir $target"
        return 0
      }
      rmdir "$target" 2>/dev/null || true
    fi
  fi
}

backup_existing() {
  local target="$1"
  [ "$DO_BACKUP" != "1" ] && return 0
  if [ -e "$target" ] && [ ! -L "$target" ]; then
    local backup="${target}.bak.${TIMESTAMP}"
    [ "$DRY_RUN" = "1" ] && {
      echo "DRY-RUN backup $target -> $backup"
      return 0
    }
    mv "$target" "$backup" 2>/dev/null && print_info "Backup created: $backup" || true
  fi
}

create_symlink() {
  local src="$1" dest="$2"
  if [ -z "$dest" ]; then
    dest="$HOME/$src"
  else
    dest="$HOME/$dest"
  fi
  local resolved
  resolved="$(resolve_path "$src")" || return 1
  backup_existing "$dest"
  safe_remove "$dest"
  if [ "$DRY_RUN" = "1" ]; then
    echo "DRY-RUN ln -s $resolved -> $dest"
  else
    ln -snf "$resolved" "$dest"
  fi
}

summary_added=()
add_summary() { summary_added+=("$1 -> $2"); }

shopt -s dotglob
pushd ./home >/dev/null || exit 1

for file in *; do
  base="$(basename "$file")"
  create_symlink "$base" >/dev/null 2>&1 && add_summary "$base" "~/$base" && print_purple "📁 Linked $base"
done

# Link SSH config specially
mkdir -p "$HOME/.ssh"
create_symlink ".ssh-config" ".ssh/config" >/dev/null 2>&1 && add_summary ".ssh-config" "~/.ssh/config" && print_purple "📁 Linked .ssh/config"
safe_remove "$HOME/.ssh-config"

shopt -u dotglob
popd >/dev/null || true

if [ "$DRY_RUN" = "1" ]; then
  print_info "Symlink dry run complete (no changes applied)."
else
  print_success "Everything linked!"
fi

if [ ${#summary_added[@]} -gt 0 ]; then
  print_info "Symlinks created:"
  for s in "${summary_added[@]}"; do echo "   $s"; done
fi
