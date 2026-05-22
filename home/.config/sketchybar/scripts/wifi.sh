#!/usr/bin/env bash
set -euo pipefail

# Output: {"ssid":"Network Name","status":"connected","device":"en0",...}

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/sbin:/usr/bin:/bin:$PATH"

_HAS_JQ=false
command -v jq >/dev/null 2>&1 && _HAS_JQ=true

json_string() {
  local value="${1:-}"

  if $_HAS_JQ; then
    jq -Rn --arg value "$value" '$value'
    return
  fi

  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/ }"
  value="${value//$'\r'/ }"
  printf '"%s"' "$value"
}

print_status() {
  local status="$1"
  local ssid="${2:-}"
  local device="${3:-}"
  local ipv4="${4:-}"
  local subnet="${5:-}"
  local router="${6:-}"
  local dns="${7:-}"
  local bssid="${8:-}"
  local security="${9:-}"
  local channel="${10:-}"

  printf '{"ssid":%s,"status":%s,"device":%s,"ipv4":%s,"subnet":%s,"router":%s,"dns":%s,"bssid":%s,"security":%s,"channel":%s}\n' \
    "$(json_string "$ssid")" \
    "$(json_string "$status")" \
    "$(json_string "$device")" \
    "$(json_string "$ipv4")" \
    "$(json_string "$subnet")" \
    "$(json_string "$router")" \
    "$(json_string "$dns")" \
    "$(json_string "$bssid")" \
    "$(json_string "$security")" \
    "$(json_string "$channel")"
}

get_ipconfig_summary() {
  local device="$1"
  ipconfig getsummary "$device" 2>/dev/null || true
}

parse_summary() {
  awk '
    function trim(value) {
      sub(/^[[:space:]]+/, "", value)
      sub(/[[:space:]]+$/, "", value)
      sub(/^"/, "", value)
      sub(/"$/, "", value)
      return value
    }

    function value_after_colon(line) {
      sub(/^[^:]+:[[:space:]]*/, "", line)
      return trim(line)
    }

    /^[[:space:]]*SSID[[:space:]]*:/ {
      ssid = value_after_colon($0)
      next
    }

    /^[[:space:]]*BSSID[[:space:]]*:/ {
      bssid = value_after_colon($0)
      next
    }

    /^[[:space:]]*Security[[:space:]]*:/ {
      security = value_after_colon($0)
      next
    }

    /^[[:space:]]*Channel[[:space:]]*:/ {
      channel = value_after_colon($0)
      next
    }

    /^[[:space:]]*Router[[:space:]]*:/ {
      router = value_after_colon($0)
      next
    }

    /^[[:space:]]*Addresses[[:space:]]*:/ {
      in_addresses = 1
      in_subnets = 0
      in_dns = 0
      next
    }

    /^[[:space:]]*SubnetMasks[[:space:]]*:/ {
      in_addresses = 0
      in_subnets = 1
      in_dns = 0
      next
    }

    /^[[:space:]]*DNS[[:space:]]*:/ {
      in_addresses = 0
      in_subnets = 0
      in_dns = 1
      next
    }

    /^[[:space:]]*[0-9]+[[:space:]]*:/ {
      value = value_after_colon($0)
      if (in_addresses && ipv4 == "") {
        ipv4 = value
      } else if (in_subnets && subnet == "") {
        subnet = value
      } else if (in_dns && value != "") {
        dns = dns == "" ? value : dns ", " value
      }
      next
    }

    END {
      printf "%s|%s|%s|%s|%s|%s|%s|%s\n", ssid, ipv4, subnet, router, dns, bssid, security, channel
    }
  '
}

main() {
  local device="${WIFI_INTERFACE:-en0}"
  if ! command -v ipconfig >/dev/null 2>&1; then
    print_status "unavailable"
    return 0
  fi

  local summary ssid ipv4 subnet router dns bssid security channel
  summary="$(get_ipconfig_summary "$device")"
  if [ -z "$summary" ]; then
    print_status "unavailable" "" "$device"
    return 0
  fi

  IFS='|' read -r ssid ipv4 subnet router dns bssid security channel <<<"$(printf '%s\n' "$summary" | parse_summary)"

  if [ -n "$ssid" ]; then
    print_status "connected" "$ssid" "$device" "$ipv4" "$subnet" "$router" "$dns" "$bssid" "$security" "$channel"
  else
    print_status "disconnected" "" "$device" "$ipv4" "$subnet" "$router" "$dns" "$bssid" "$security" "$channel"
  fi
}

main "$@"
