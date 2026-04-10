#!/usr/bin/env bash
set -euo pipefail

# cpu.sh
# Basic output:  19
# Detail output: {"usage":19,"cpu_breakdown":"11.46% user, 7.47% sys, 81.5% idle", ...}

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

trim() {
  local value="${1:-}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

extract_line() {
  local prefix="$1"
  local source="$2"

  printf '%s\n' "$source" | awk -v prefix="$prefix" '
    index($0, prefix) == 1 {
      line = substr($0, length(prefix) + 1)
      sub(/^[[:space:]]+/, "", line)
      sub(/[[:space:]]+$/, "", line)
      sub(/\.$/, "", line)
      print line
      exit
    }
  '
}

get_top_output() {
  top -l 1 -o cpu -n 5 -stats pid,command,cpu,mem,threads,state 2>/dev/null || true
}

get_usage_from_output() {
  local source="$1"
  local cpu_line usage

  cpu_line=$(extract_line "CPU usage:" "$source")
  usage=$(printf '%s\n' "$cpu_line" | awk -F',' '
    {
      for (i = 1; i <= NF; i++) {
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", $i)
        if ($i ~ /idle$/) {
          value = $i
          gsub(/[^0-9.]/, "", value)
          printf "%.0f", 100 - value
          exit
        }
      }
    }
  ')

  printf '%s' "${usage:-0}"
}

get_root_disk_usage() {
  df -h / 2>/dev/null | awk 'NR == 2 { print $3 " used, " $4 " free, " $5 " full"; exit }'
}

get_temperature() {
  local value=""

  if command -v osx-cpu-temp >/dev/null 2>&1; then
    value=$(osx-cpu-temp -C 2>/dev/null | grep -Eo '[0-9]+([.][0-9]+)?' | head -1 || true)
  fi

  if [ -z "$value" ] && command -v istats >/dev/null 2>&1; then
    value=$(istats cpu temp --value-only 2>/dev/null | grep -Eo '[0-9]+([.][0-9]+)?' | head -1 || true)
    if [ -z "$value" ]; then
      value=$(istats cpu temp --no-graphs --no-labels 2>/dev/null | grep -Eo '[0-9]+([.][0-9]+)?' | head -1 || true)
    fi
    if [ -z "$value" ]; then
      value=$(istats cpu --value-only 2>/dev/null | grep -Eo '[0-9]+([.][0-9]+)?' | head -1 || true)
    fi
  fi

  if [ -n "$value" ]; then
    printf '%s°C' "$value"
  else
    printf 'Unavailable'
  fi
}

get_hot_processes() {
  ps -arcx -o pid= -o %cpu= -o %mem= -o comm= 2>/dev/null | awk '
    {
      pid = $1
      cpu = $2
      mem = $3
      $1 = ""
      $2 = ""
      $3 = ""
      sub(/^[[:space:]]+/, "", $0)
      name = $0
      sub(/^.*\//, "", name)

      if (name == "" || name == "top" || name == "ps" || name == "sketchybar") {
        next
      }

      printf "%s\t%s\t%s\t%s\n", pid, cpu, mem, name
      count++
      if (count == 3) {
        exit
      }
    }
  '
}

get_basic() {
  local top_output
  top_output=$(get_top_output)

  if [ -z "$top_output" ]; then
    printf '0\n'
    return
  fi

  get_usage_from_output "$top_output"
  printf '\n'
}

get_detail() {
  local top_output usage cpu_breakdown load_avg processes memory network disk_io storage temperature
  top_output=$(get_top_output)

  usage=0
  cpu_breakdown="--"
  load_avg="--"
  processes="--"
  memory="--"
  network="--"
  disk_io="--"
  storage="$(get_root_disk_usage || true)"
  temperature="$(get_temperature)"

  if [ -n "$top_output" ]; then
    usage=$(get_usage_from_output "$top_output")
    cpu_breakdown=$(extract_line "CPU usage:" "$top_output")
    load_avg=$(extract_line "Load Avg:" "$top_output")
    processes=$(extract_line "Processes:" "$top_output")
    memory=$(extract_line "PhysMem:" "$top_output")
    network=$(extract_line "Networks:" "$top_output")
    disk_io=$(extract_line "Disks:" "$top_output")
  fi

  storage=$(trim "${storage:-}")
  if [ -z "$storage" ]; then
    storage="--"
  fi

  local -a hot_processes=()
  while IFS= read -r line; do
    hot_processes+=("$line")
  done < <(get_hot_processes)

  while [ "${#hot_processes[@]}" -lt 3 ]; do
    hot_processes+=("--")
  done

  if ! command -v jq >/dev/null 2>&1; then
    printf '%s\n' "${usage:-0}"
    return
  fi

  jq -n \
    --argjson usage "${usage:-0}" \
    --arg cpu_breakdown "${cpu_breakdown:-"--"}" \
    --arg load_avg "${load_avg:-"--"}" \
    --arg processes "${processes:-"--"}" \
    --arg memory "${memory:-"--"}" \
    --arg network "${network:-"--"}" \
    --arg disk_io "${disk_io:-"--"}" \
    --arg storage "${storage:-"--"}" \
    --arg temperature "${temperature:-"Unavailable"}" \
    --arg top_1 "${hot_processes[0]}" \
    --arg top_2 "${hot_processes[1]}" \
    --arg top_3 "${hot_processes[2]}" \
    '{
      usage: $usage,
      cpu_breakdown: $cpu_breakdown,
      load_avg: $load_avg,
      processes: $processes,
      memory: $memory,
      network: $network,
      disk_io: $disk_io,
      storage: $storage,
      temperature: $temperature,
      top_1: $top_1,
      top_2: $top_2,
      top_3: $top_3
    }'
}

case "${1:-}" in
  --detail) get_detail ;;
  *) get_basic ;;
esac
