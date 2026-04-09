#!/usr/bin/env bash

source ~/.config/zsh/utils.sh

function run_update_step {
  local label="$1"
  shift

  print_start "$label"
  if "$@"; then
    print_success "$label done"
  else
    print_error "$label failed"
    return 1
  fi
}

function update_homebrew {
  brew update && brew upgrade && brew upgrade --cask --greedy-auto-updates && brew autoremove && brew cleanup -s
}

function update_ruby_gems {
  gem update --system && gem update
}

function update_python_venv {
  local venv_dir="$1"
  local outdated

  "$venv_dir/bin/pip" install --upgrade pip || return 1
  outdated=$("$venv_dir/bin/pip" list --outdated --format=json 2>/dev/null | "$venv_dir/bin/python" -c 'import json, sys; print("\n".join(package["name"] for package in json.load(sys.stdin)))')

  [[ -z "$outdated" ]] && return 0

  while IFS= read -r package; do
    [[ -z "$package" ]] && continue
    "$venv_dir/bin/pip" install -U "$package" || return 1
  done <<<"$outdated"
}

function update_luarocks_packages {
  local outdated_rocks

  outdated_rocks="$(luarocks list --outdated --porcelain 2>/dev/null | awk '{print $1}' | uniq)"
  [[ -z "$outdated_rocks" ]] && return 0

  while IFS= read -r rock; do
    [[ -z "$rock" ]] && continue
    luarocks install "$rock" || return 1
  done <<<"$outdated_rocks"
}

function updateSystem {
  local had_failures=0

  clear

  print_green "💻 Updating system tools\n"

  authenticateBeforeUpdate
  clear

  print_green "💻 Updating system tools\n"

  # --- macOS software updates ---
  run_update_step "Checking macOS software updates" softwareupdate --install --all || had_failures=1

  # --- Homebrew ---
  if command -v brew >/dev/null 2>&1; then
    run_update_step "Updating Homebrew" update_homebrew || had_failures=1
  fi

  # --- mise runtimes ---
  if command -v mise >/dev/null 2>&1; then
    run_update_step "Updating mise runtimes" mise upgrade || had_failures=1
  fi

  # --- Global Node packages ---
  if command -v pnpm >/dev/null 2>&1; then
    run_update_step "Updating global pnpm packages" pnpm update -g || had_failures=1
  fi

  # --- Ruby ---
  if command -v gem >/dev/null 2>&1; then
    run_update_step "Updating Ruby gems" update_ruby_gems || had_failures=1
  fi

  # --- Python venv ---
  local venv_dir="$HOME/.local/share/venv"
  if [[ -f "$venv_dir/bin/python" ]]; then
    run_update_step "Updating Python venv packages" update_python_venv "$venv_dir" || had_failures=1
  fi

  # --- Rust ---
  if command -v rustup >/dev/null 2>&1; then
    run_update_step "Updating Rust toolchain" rustup update || had_failures=1
  fi

  # --- Lua ---
  if command -v luarocks >/dev/null 2>&1; then
    run_update_step "Updating LuaRocks packages" update_luarocks_packages || had_failures=1
  fi

  if [[ "$had_failures" -eq 0 ]]; then
    print_success "💻 Updated! \n"
  else
    print_error "💻 Update completed with failures.\n"
  fi

}

# Cache file for system info (refreshed daily or on demand)
_SYSINFO_CACHE="$HOME/.cache/systeminfo_cache"
_SYSINFO_CACHE_AGE=86400 # 24 hours in seconds

function _refresh_sysinfo_cache {
  mkdir -p "$(dirname "$_SYSINFO_CACHE")"

  local hardware_info=$(system_profiler SPHardwareDataType 2>/dev/null)
  local model_name=$(echo "$hardware_info" | awk -F': ' '/^ *Model Name:/ {print $2; exit}')
  local chip_name=$(echo "$hardware_info" | awk -F': ' '/^ *Chip:/ {print $2; exit}')
  local memory=$(echo "$hardware_info" | awk -F': ' '/^ *Memory:/ {print $2; exit}')

  # Determine built-in display size heuristically via resolution width.
  local display_size=""
  local display_info=$(system_profiler SPDisplaysDataType 2>/dev/null)
  # Look specifically for the built-in display resolution, not external monitors
  local resolution_line=$(echo "$display_info" | awk '/Built-in/,/Resolution:/' | awk -F': ' '/Resolution:/ {print $2; exit}')
  local width=$(echo "$resolution_line" | awk '{print $1}')

  case "$width" in
  3456) display_size='16"' ;;
  3024) display_size='14"' ;;
  2880) display_size='15"' ;;
  2560) display_size='13"' ;;
  2304) display_size='12"' ;;
  esac

  # Append size to model name if detected.
  if [ -n "$display_size" ]; then
    model_name="$model_name $display_size"
  fi

  # Replace Apple with an empty string
  chip_name=$(echo "$chip_name" | sed 's/Apple //g')

  echo "$model_name|$chip_name|$memory" >"$_SYSINFO_CACHE"
}

function systeminfo {
  if ! command -v system_profiler >/dev/null 2>&1; then
    return
  fi

  # Check if cache exists and is fresh (less than 24 hours old)
  if [[ ! -f "$_SYSINFO_CACHE" ]] || [[ $(($(date +%s) - $(stat -f %m "$_SYSINFO_CACHE" 2>/dev/null || echo 0))) -gt $_SYSINFO_CACHE_AGE ]]; then
    _refresh_sysinfo_cache
  fi

  # Read cached values
  local cached_data=$(cat "$_SYSINFO_CACHE" 2>/dev/null)
  local model_name=$(echo "$cached_data" | cut -d'|' -f1)
  local chip_name=$(echo "$cached_data" | cut -d'|' -f2)
  local memory=$(echo "$cached_data" | cut -d'|' -f3)

  # Disk size - fast, no need to cache
  local disk_size=$(df -H / 2>/dev/null | awk 'NR==2 {print $2}')

  # Remove "G" from string and convert to number
  disk_size=$(echo "$disk_size" | sed 's/G//' | awk '{print int($1)}')

  # Convert GB to TB
  if [ "$disk_size" -ge 990 ]; then
    disk_size=$(awk "BEGIN {printf \"%.1f\", $disk_size/1024}" | awk '{print int($1)}')
    disk_size="${disk_size}TB"
  else
    disk_size="${disk_size}GB"
  fi

  desc="Apple $model_name / $chip_name / $memory RAM / $disk_size"

  print_yellow "\n  💻 $desc\n"

  if command -v neofetch >/dev/null 2>&1; then
    neofetch
  fi
}

# Force refresh system info cache
function refresh_sysinfo {
  _refresh_sysinfo_cache
  echo "System info cache refreshed!"
}
