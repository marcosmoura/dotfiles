#!/usr/bin/env bash

source ~/.config/zsh/utils.sh

function updateSystem {
  clear

  print_green "💻 Updating system tools\n"

  authenticateBeforeUpdate
  clear

  print_green "💻 Updating system tools\n"

  # --- macOS software updates ---
  print_start "Checking macOS software updates"
  softwareupdate --install --all 2>/dev/null || true
  print_success "macOS updates done"

  # --- Homebrew ---
  if command -v brew >/dev/null 2>&1; then
    print_start "Updating Homebrew"
    brew update && brew upgrade && brew upgrade --cask --greedy-auto-updates
    brew autoremove
    brew cleanup -s
    print_success "Homebrew updated"
  fi

  # --- mise runtimes ---
  if command -v mise >/dev/null 2>&1; then
    print_start "Updating mise runtimes"
    mise upgrade
    print_success "mise runtimes updated"
  fi

  # --- Global Node packages ---
  if command -v pnpm >/dev/null 2>&1; then
    print_start "Updating global pnpm packages"
    pnpm update -g || true
    print_success "pnpm globals updated"
  fi

  # --- Ruby ---
  if command -v gem >/dev/null 2>&1; then
    print_start "Updating Ruby gems"
    gem update --system 2>/dev/null || true
    gem update || true
    print_success "Ruby gems updated"
  fi

  # --- Python venv ---
  local venv_dir="$HOME/.local/share/venv"
  if [[ -f "$venv_dir/bin/python" ]]; then
    print_start "Updating Python venv packages"
    "$venv_dir/bin/pip" install --upgrade pip 2>/dev/null || true
    "$venv_dir/bin/pip" list --outdated 2>/dev/null | awk '{if(NR>2)print $1}' | xargs -n1 "$venv_dir/bin/pip" install -U 2>/dev/null || true
    print_success "Python packages updated"
  fi

  # --- Rust ---
  if command -v rustup >/dev/null 2>&1; then
    print_start "Updating Rust toolchain"
    rustup update || true
    print_success "Rust updated"
  fi

  # --- Lua ---
  if command -v luarocks >/dev/null 2>&1; then
    print_start "Updating Luarocks packages"
    luarocks install --only-deps 2>/dev/null || true
    print_success "Luarocks updated"
  fi

  print_success "💻 Updated! \n"

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

  neofetch
}

# Force refresh system info cache
function refresh_sysinfo {
  _refresh_sysinfo_cache
  echo "System info cache refreshed!"
}
