#!/usr/bin/env bash
set -euo pipefail

# battery.sh
# Retrieve battery information from pmset and ioreg.
#
# Usage:
#   battery.sh           -- basic info (percentage, charging state)
#   battery.sh --detail  -- extended info (cycles, health, temperature, time remaining)
#
# Basic output:  {"percentage":85,"state":"charging"}
# Detail output: {"percentage":85,"state":"charging","cycles":"42","health":"97%",
#                 "temp":"30.5°C","time_remaining":"1:23"}

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

get_basic() {
  if ! command -v pmset >/dev/null 2>&1; then
    echo '{"percentage":0,"state":"unavailable"}'
    return
  fi

  local batt_info
  batt_info=$(pmset -g batt)

  local percentage
  percentage=$(echo "$batt_info" | grep -o '[0-9]*%' | head -1 | tr -d '%' || true)

  local state="discharging"
  if echo "$batt_info" | grep -q "AC Power"; then
    if echo "$batt_info" | grep -q "charged"; then
      state="full"
    else
      state="charging"
    fi
  fi

  echo "{\"percentage\":${percentage:-0},\"state\":\"$state\"}"
}

get_detail() {
  if ! command -v pmset >/dev/null 2>&1; then
    echo '{"percentage":0,"state":"unavailable","cycles":"--","health":"--","temp":"--","time_remaining":"--"}'
    return
  fi

  local batt_info
  batt_info=$(pmset -g batt)

  local percentage
  percentage=$(echo "$batt_info" | grep -o '[0-9]*%' | head -1 | tr -d '%' || true)

  local state="discharging"
  if echo "$batt_info" | grep -q "AC Power"; then
    if echo "$batt_info" | grep -q "charged"; then
      state="full"
    else
      state="charging"
    fi
  fi

  # Use -rn and match exact "Key" = Value lines to avoid nested dictionary blobs
  local ioreg_data
  ioreg_data=$(ioreg -rn AppleSmartBattery 2>/dev/null)

  # Cycle count
  local cycles
  cycles=$(echo "$ioreg_data" | grep '"CycleCount" =' | head -1 | awk -F'= ' '{print $2}' | tr -d ' ' || true)

  # Battery health (raw max capacity vs original design capacity)
  local max_cap
  max_cap=$(echo "$ioreg_data" | grep '"AppleRawMaxCapacity" =' | head -1 | awk -F'= ' '{print $2}' | tr -d ' ' || true)
  local design_cap
  design_cap=$(echo "$ioreg_data" | grep '"DesignCapacity" =' | head -1 | awk -F'= ' '{print $2}' | tr -d ' ' || true)

  local health=100
  if [[ "$max_cap" =~ ^[0-9]+$ ]] && [[ "$design_cap" =~ ^[0-9]+$ ]] && [ "$design_cap" -gt 0 ]; then
    health=$(((max_cap * 100) / design_cap))
  fi

  # Temperature (ioreg reports in centi-degrees Celsius)
  local temp_raw
  temp_raw=$(echo "$ioreg_data" | grep '"Temperature" =' | head -1 | awk -F'= ' '{print $2}' | tr -d ' ' || true)
  local temp="--"
  if [ -n "$temp_raw" ]; then
    temp=$(awk -v raw="$temp_raw" 'BEGIN { printf "%.1f", raw / 100 }')
  fi

  # Time remaining (reuse batt_info from above instead of calling pmset again)
  local time_remaining="--"
  local time_info
  time_info=$(echo "$batt_info" | grep -Eo '[0-9]*:[0-9]* (remaining|until charged)' | head -1 || true)
  if [ -n "$time_info" ]; then
    time_remaining=$(echo "$time_info" | awk '{print $1}')
  fi

  if ! command -v jq >/dev/null 2>&1; then
    printf '{"percentage":%s,"state":"%s","cycles":"%s","health":"%s","temp":"%s","time_remaining":"%s"}\n' \
      "${percentage:-0}" \
      "${state:-unavailable}" \
      "${cycles:---}" \
      "${health}%" \
      "${temp}°C" \
      "${time_remaining:---}"
    return
  fi

  jq -n \
    --argjson percentage "${percentage:-0}" \
    --arg state "$state" \
    --arg cycles "${cycles:-0}" \
    --arg health "${health}%" \
    --arg temp "${temp}°C" \
    --arg time_remaining "$time_remaining" \
    '{percentage: $percentage, state: $state, cycles: $cycles, health: $health, temp: $temp, time_remaining: $time_remaining}'
}

case "${1:-}" in
  --detail) get_detail ;;
  *) get_basic ;;
esac
