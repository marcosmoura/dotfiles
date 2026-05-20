#!/usr/bin/env bash
set -euo pipefail

# weather.sh
# Fetch current weather data with caching support.
# Uses Open-Meteo API (free, no API key) and macOS Shortcuts for location.
# Returns JSON: {"temp":"22°C","feels_like":"20°C","condition":"Sunny","icon":"clearDay",
#                "high":"24°C","low":"18°C","humidity":"45%","wind":"8 km/h","location":"Lisbon"}

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

CACHE_FILE="/tmp/sketchybar_weather.json"
CACHE_MAX_AGE=1200 # 20 minutes
LOCATION_CACHE="/tmp/sketchybar_location.json"
LOCATION_MAX_AGE=3600 # 1 hour
SHORTCUT_NAME="SketchyBar Location"
DEFAULT_RESULT='{"temp":"--","feels_like":"--","condition":"Unknown","icon":"clearDay","high":"--","low":"--","humidity":"--","wind":"--","location":""}'

print_cache_or_default() {
  if [ -f "$CACHE_FILE" ]; then
    cat "$CACHE_FILE"
  else
    printf '%s\n' "$DEFAULT_RESULT"
  fi
}

if ! command -v curl >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
  print_cache_or_default
  exit 0
fi

# Return cached weather if still fresh
if [ -f "$CACHE_FILE" ]; then
  age=$(($(date +%s) - $(stat -f %m "$CACHE_FILE")))
  if [ "$age" -lt "$CACHE_MAX_AGE" ]; then
    cat "$CACHE_FILE"
    exit 0
  fi
fi

# ---------------------------------------------------------------------------
# Location — macOS Shortcuts
# ---------------------------------------------------------------------------
# Requires a Shortcut named "SketchyBar Location" that outputs a single line:
#   latitude,longitude,city
# e.g.: 38.7167,-9.1333,Lisbon
#
# To create it in Shortcuts.app:
#   1. New Shortcut → name it "SketchyBar Location"
#   2. Add "Get Current Location"
#   3. Add "Text" with content:
#        [Latitude],[Longitude],[City]
#      (use the magic variable tokens from step 2)
#   4. Add "Stop and Output" → select the Text from step 3

get_location() {
  # Serve cached location if fresh
  if [ -f "$LOCATION_CACHE" ]; then
    local age=$(($(date +%s) - $(stat -f %m "$LOCATION_CACHE")))
    if [ "$age" -lt "$LOCATION_MAX_AGE" ]; then
      cat "$LOCATION_CACHE"
      return 0
    fi
  fi

  local raw loc
  raw=$(shortcuts run "$SHORTCUT_NAME" 2>/dev/null | head -1) || true

  if [ -n "$raw" ]; then
    local lat lon city
    lat=$(echo "$raw" | cut -d',' -f1)
    lon=$(echo "$raw" | cut -d',' -f2)
    city=$(echo "$raw" | cut -d',' -f3-)

    if [ -n "$lat" ] && [ -n "$lon" ]; then
      loc=$(jq -n \
        --arg lat "$lat" \
        --arg lon "$lon" \
        --arg city "$city" \
        '{latitude: ($lat | tonumber), longitude: ($lon | tonumber), city: $city}') || true

      if [ -n "$loc" ]; then
        echo "$loc" >"$LOCATION_CACHE"
        echo "$loc"
        return 0
      fi
    fi
  fi

  # Stale cache as fallback
  [ -f "$LOCATION_CACHE" ] && cat "$LOCATION_CACHE" && return 0
  return 1
}

location=$(get_location) || {
  print_cache_or_default
  exit 0
}

lat=$(echo "$location" | jq -r '.latitude')
lon=$(echo "$location" | jq -r '.longitude')
city=$(echo "$location" | jq -r '.city // ""')

# ---------------------------------------------------------------------------
# WMO weather-code mappings
# ---------------------------------------------------------------------------

map_wmo_icon() {
  local code="$1"
  local is_day="$2"

  case "$code" in
  0 | 1)
    [ "$is_day" = "1" ] && echo "clearDay" || echo "clearNight"
    ;;
  2)
    [ "$is_day" = "1" ] && echo "partlyCloudyDay" || echo "partlyCloudyNight"
    ;;
  3)
    echo "cloudy"
    ;;
  45 | 48)
    echo "fog"
    ;;
  51 | 53 | 55 | 56 | 57)
    echo "rain"
    ;;
  61 | 63 | 65 | 66 | 67)
    echo "rain"
    ;;
  71 | 73 | 75 | 77)
    echo "snow"
    ;;
  80 | 81 | 82)
    [ "$is_day" = "1" ] && echo "rainDay" || echo "rainNight"
    ;;
  85 | 86)
    [ "$is_day" = "1" ] && echo "snowShowersDay" || echo "snowShowersNight"
    ;;
  95)
    echo "thunder"
    ;;
  96 | 99)
    [ "$is_day" = "1" ] && echo "thunderShowersDay" || echo "thunderShowersNight"
    ;;
  *)
    [ "$is_day" = "1" ] && echo "clearDay" || echo "clearNight"
    ;;
  esac
}

map_wmo_condition() {
  local code="$1"
  case "$code" in
  0) echo "Clear sky" ;;
  1) echo "Mainly clear" ;;
  2) echo "Partly cloudy" ;;
  3) echo "Overcast" ;;
  45) echo "Fog" ;;
  48) echo "Rime fog" ;;
  51) echo "Light drizzle" ;;
  53) echo "Drizzle" ;;
  55) echo "Dense drizzle" ;;
  56 | 57) echo "Freezing drizzle" ;;
  61) echo "Light rain" ;;
  63) echo "Rain" ;;
  65) echo "Heavy rain" ;;
  66 | 67) echo "Freezing rain" ;;
  71) echo "Light snow" ;;
  73) echo "Snow" ;;
  75) echo "Heavy snow" ;;
  77) echo "Snow grains" ;;
  80) echo "Light showers" ;;
  81) echo "Showers" ;;
  82) echo "Heavy showers" ;;
  85) echo "Light snow showers" ;;
  86) echo "Heavy snow showers" ;;
  95) echo "Thunderstorm" ;;
  96 | 99) echo "Thunderstorm with hail" ;;
  *) echo "Unknown" ;;
  esac
}

# ---------------------------------------------------------------------------
# Fetch weather from Open-Meteo
# ---------------------------------------------------------------------------

api_url="https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1"

weather=$(curl -sf "$api_url" 2>/dev/null) || true

if [ -n "$weather" ] && echo "$weather" | jq -e '.current' >/dev/null 2>&1; then
  eval "$(echo "$weather" | jq -r '
    (.current) as $c |
    (.daily) as $d |
    "wmo_code=" + ($c.weather_code | tostring | @sh) +
    " is_day=" + ($c.is_day | tostring | @sh) +
    " temp=" + ($c.temperature_2m | round | tostring | @sh) +
    " feels_like=" + ($c.apparent_temperature | round | tostring | @sh) +
    " humidity=" + ($c.relative_humidity_2m | round | tostring | @sh) +
    " wind=" + ($c.wind_speed_10m | round | tostring | @sh) +
    " high=" + ($d.temperature_2m_max[0] | round | tostring | @sh) +
    " low=" + ($d.temperature_2m_min[0] | round | tostring | @sh)
  ')"

  icon=$(map_wmo_icon "$wmo_code" "$is_day")
  condition=$(map_wmo_condition "$wmo_code")

  result=$(jq -n \
    --arg temp "${temp}°C" \
    --arg feels_like "${feels_like}°C" \
    --arg condition "$condition" \
    --arg icon "$icon" \
    --arg high "${high}°C" \
    --arg low "${low}°C" \
    --arg humidity "${humidity}%" \
    --arg wind "${wind} km/h" \
    --arg location "$city" \
    '{temp: $temp, feels_like: $feels_like, condition: $condition, icon: $icon, high: $high, low: $low, humidity: $humidity, wind: $wind, location: $location}')

  echo "$result" >"$CACHE_FILE"
  echo "$result"
else
  print_cache_or_default
fi
