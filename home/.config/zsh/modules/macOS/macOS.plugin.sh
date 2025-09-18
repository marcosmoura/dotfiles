#!/usr/bin/env bash

source ~/.config/zsh/utils.sh

function updateSystem {
  clear

  print_green "💻 Updating system tools\n"

  authenticateBeforeUpdate
  clear

  print_green "💻 Updating system tools\n"

  topgrade
  fsh-alias $XDG_CONFIG_HOME/syntax-theme/syntax-theme.ini >/dev/null 2>&1

  print_success "💻 Updated! \n"
}

function systeminfo {
  if ! command -v system_profiler >/dev/null 2>&1; then
    return
  fi

  local hardware_info=$(system_profiler SPHardwareDataType 2>/dev/null)
  local model_name=$(echo "$hardware_info" | awk -F': ' '/^ *Model Name:/ {print $2; exit}')
  local chip_name=$(echo "$hardware_info" | awk -F': ' '/^ *Chip:/ {print $2; exit}')
  local memory=$(echo "$hardware_info" | awk -F': ' '/^ *Memory:/ {print $2; exit}')
  local disk_size=$(df -H / 2>/dev/null | awk 'NR==2 {print $2}')

  # Determine built-in display size heuristically via resolution width.
  local display_size=""
  local display_info=$(system_profiler SPDisplaysDataType 2>/dev/null)
  local resolution_line=$(echo "$display_info" | awk -F': ' '/Resolution:/ {print $2; exit}')
  local width=$(echo "$resolution_line" | awk '{print $1}')

  case "$width" in
  3456 | 3072) display_size='16"' ;;
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

  print_yellow "\n  💻  $desc\n"

  fastfetch
}
