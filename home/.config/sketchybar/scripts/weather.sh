#!/usr/bin/env bash
set -euo pipefail

# weather.sh
# Fetch current weather data with caching support.
# Uses wttr.in (free, no API key required) and caches results for 20 minutes.
# Returns JSON: {"temp":"22°C","feels_like":"20°C","condition":"Sunny","icon":"clear",
#                "high":"24°C","low":"18°C","humidity":"45%","wind":"8 km/h"}

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

CACHE_FILE="/tmp/sketchybar_weather.json"
CACHE_MAX_AGE=1200 # 20 minutes in seconds

# Return cached data if still fresh
if [ -f "$CACHE_FILE" ]; then
  age=$(($(date +%s) - $(stat -f %m "$CACHE_FILE")))
  if [ "$age" -lt "$CACHE_MAX_AGE" ]; then
    cat "$CACHE_FILE"
    exit 0
  fi
fi

# Map wttr.in condition descriptions to short icon keys
map_condition() {
  local condition
  condition=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')

  case "$condition" in
  *clear* | *sunny*) echo "clear" ;;
  *cloud* | *overcast*) echo "cloudy" ;;
  *rain* | *drizzle* | *shower*) echo "rainy" ;;
  *snow* | *sleet* | *blizzard*) echo "snowy" ;;
  *thunder* | *storm*) echo "stormy" ;;
  *fog* | *mist* | *haze*) echo "foggy" ;;
  *wind* | *gale* | *breezy*) echo "windy" ;;
  *) echo "default" ;;
  esac
}

# Fetch weather from wttr.in
weather=$(curl -sf "wttr.in/?format=j1" 2>/dev/null) || true

if [ -n "$weather" ]; then
  current=$(echo "$weather" | jq -r '.current_condition[0]')
  temp=$(echo "$current" | jq -r '.temp_C')
  feels_like=$(echo "$current" | jq -r '.FeelsLikeC')
  condition=$(echo "$current" | jq -r '.weatherDesc[0].value')
  humidity=$(echo "$current" | jq -r '.humidity')
  wind=$(echo "$current" | jq -r '.windspeedKmph')
  location=$(echo "$weather" | jq -r '.nearest_area[0].areaName[0].value')

  forecast=$(echo "$weather" | jq -r '.weather[0]')
  high=$(echo "$forecast" | jq -r '.maxtempC')
  low=$(echo "$forecast" | jq -r '.mintempC')

  icon=$(map_condition "$condition")

  result=$(jq -n \
    --arg temp "${temp}°C" \
    --arg feels_like "${feels_like}°C" \
    --arg condition "$condition" \
    --arg icon "$icon" \
    --arg high "${high}°C" \
    --arg low "${low}°C" \
    --arg humidity "${humidity}%" \
    --arg wind "${wind} km/h" \
    --arg location "$location" \
    '{temp: $temp, feels_like: $feels_like, condition: $condition, icon: $icon, high: $high, low: $low, humidity: $humidity, wind: $wind, location: $location}')

  echo "$result" >"$CACHE_FILE"
  echo "$result"
else
  # Network failure -- serve stale cache if available, otherwise return defaults
  if [ -f "$CACHE_FILE" ]; then
    cat "$CACHE_FILE"
  else
    echo '{"temp":"--","feels_like":"--","condition":"Unknown","icon":"default","high":"--","low":"--","humidity":"--","wind":"--","location":""}'
  fi
fi
