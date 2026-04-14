#!/usr/bin/env bash
set -euo pipefail

# weather.sh
# Fetch current weather data with caching support.
# Uses wttr.in (free, no API key required) and caches results for 20 minutes.
# Returns JSON: {"temp":"22°C","feels_like":"20°C","condition":"Sunny","icon":"clearDay",
#                "high":"24°C","low":"18°C","humidity":"45%","wind":"8 km/h"}

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

CACHE_FILE="/tmp/sketchybar_weather.json"
CACHE_MAX_AGE=1200 # 20 minutes in seconds
DEFAULT_RESULT='{"temp":"--","feels_like":"--","condition":"Unknown","icon":"clearDay","high":"--","low":"--","humidity":"--","wind":"--","location":""}'

print_cache_or_default() {
  if [ -f "$CACHE_FILE" ]; then
    cat "$CACHE_FILE"
  else
    printf '%s\n' "$DEFAULT_RESULT"
  fi
}

if ! command -v curl >/dev/null 2>&1; then
  print_cache_or_default
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  print_cache_or_default
  exit 0
fi

# Return cached data if still fresh
if [ -f "$CACHE_FILE" ]; then
  age=$(($(date +%s) - $(stat -f %m "$CACHE_FILE")))
  if [ "$age" -lt "$CACHE_MAX_AGE" ]; then
    cat "$CACHE_FILE"
    exit 0
  fi
fi

# Map wttr.in condition descriptions to the icon keys used by stache.
map_condition() {
  local condition
  local is_day
  condition=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  is_day="${2:-yes}"

  local day_variant=true
  if [ "$is_day" = "no" ] || [ "$is_day" = "0" ]; then
    day_variant=false
  fi

  case "$condition" in
  *thunder* | *storm*)
    if [[ "$condition" == *shower* ]] && [ "$day_variant" = true ]; then
      echo "thunderShowersDay"
    elif [ "$day_variant" = true ]; then
      echo "thunder"
    else
      echo "thunderShowersNight"
    fi
    ;;
  *snow* | *sleet* | *blizzard*)
    if [[ "$condition" == *shower* ]]; then
      if [ "$day_variant" = true ]; then
        echo "snowShowersDay"
      else
        echo "snowShowersNight"
      fi
    else
      echo "snow"
    fi
    ;;
  *rain* | *drizzle* | *shower*)
    if [[ "$condition" == *shower* ]]; then
      if [ "$day_variant" = true ]; then
        echo "rainDay"
      else
        echo "rainNight"
      fi
    else
      echo "rain"
    fi
    ;;
  *partly*cloud*)
    if [ "$day_variant" = true ]; then
      echo "partlyCloudyDay"
    else
      echo "partlyCloudyNight"
    fi
    ;;
  *cloud* | *overcast*) echo "cloudy" ;;
  *clear* | *sunny*)
    if [ "$day_variant" = true ]; then
      echo "clearDay"
    else
      echo "clearNight"
    fi
    ;;
  *fog* | *mist* | *haze*) echo "fog" ;;
  *wind* | *gale* | *breezy*) echo "windy" ;;
  *)
    if [ "$day_variant" = true ]; then
      echo "clearDay"
    else
      echo "clearNight"
    fi
    ;;
  esac
}

# Fetch weather from wttr.in
weather=$(curl -sf "wttr.in/?format=j1" 2>/dev/null) || true

if [ -n "$weather" ]; then
  eval "$(echo "$weather" | jq -r '
    (.current_condition[0]) as $c |
    (.weather[0]) as $f |
    "temp=" + ($c.temp_C | @sh) +
    " feels_like=" + ($c.FeelsLikeC | @sh) +
    " condition=" + ($c.weatherDesc[0].value | @sh) +
    " is_day=" + (($c.isday // "yes") | @sh) +
    " humidity=" + ($c.humidity | @sh) +
    " wind=" + ($c.windspeedKmph | @sh) +
    " location=" + (.nearest_area[0].areaName[0].value | @sh) +
    " high=" + ($f.maxtempC | @sh) +
    " low=" + ($f.mintempC | @sh)
  ')"

  icon=$(map_condition "$condition" "$is_day")

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
  print_cache_or_default
fi
