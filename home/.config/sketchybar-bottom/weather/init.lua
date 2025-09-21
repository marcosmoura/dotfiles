local glass = require("glass")
local sketchybar = require("sketchybar")
local inspect = require("inspect")

local icon_map = {
  ["snow"] = "❄️",
  ["snow-showers-day"] = "🌨️",
  ["snow-showers-night"] = "🌨️",
  ["thunder-rain"] = "⛈",
  ["thunder-showers-day"] = "⛈",
  ["thunder-showers-night"] = "⛈",
  ["rain"] = "🌧",
  ["showers-day"] = "🌦",
  ["showers-night"] = "🌨️",
  ["fog"] = "🌫",
  ["wind"] = "💨",
  ["cloudy"] = "☁️",
  ["partly-cloudy-day"] = "⛅",
  ["partly-cloudy-night"] = "☁️",
  ["clear-day"] = "☀️",
  ["clear-night"] = "🌙",
}

local moon_phase_icon_map = {
  new_moon = "🌑",
  waxing_crescent = "🌒",
  first_quarter = "🌓",
  waxing_gibbous = "🌔",
  full_moon = "🌕",
  waning_gibbous = "🌖",
  last_quarter = "🌗",
  waning_crescent = "🌘",
  unknown = "🌚",
}

local get_moon_phase_name = function(phase)
  if phase == nil then
    return "unknown"
  end

  if phase == 0 or phase == 1 then
    return "new_moon"
  elseif phase > 0 and phase < 0.25 then
    return "waxing_crescent"
  elseif phase == 0.25 then
    return "first_quarter"
  elseif phase > 0.25 and phase < 0.5 then
    return "waxing_gibbous"
  elseif phase == 0.5 then
    return "full_moon"
  elseif phase > 0.5 and phase < 0.75 then
    return "waning_gibbous"
  elseif phase == 0.75 then
    return "last_quarter"
  elseif phase > 0.75 and phase < 1 then
    return "waning_crescent"
  end

  return "unknown"
end

local weather_padding_right = sketchybar.add("item", "weather.padding.right", {
  position = "right",
  drawing = false,
  label = {
    padding_right = 1,
  },
})

local weather_item = glass.create_hoverable_item('weather', {
  drawing = false,
  position = "right",
  label = {
    padding_right = 12,
  },
  icon = {
    padding_left = 12,
    padding_right = 12,
    font = {
      size = 18,
      family = "Maple Mono NF",
    },
  },
}, "alias")

local weather_padding_left = sketchybar.add("item", "weather.padding.left", {
  position = "right",
  drawing = false,
  label = {
    padding_left = 1,
  },
})

local weather_watcher = sketchybar.add("item", "weather.watcher", {
  drawing = false,
})

local function on_weather_changed(env)
  local weather = env["WEATHER"]
  local drawing = {
    drawing = true,
  }

  if not weather then
    return
  end

  local feels_like = math.ceil(weather.feels_like)
  local moon_phase = get_moon_phase_name(weather.moon_phase)
  local description = weather.description:gsub("^%l", string.upper):gsub("%.$", "")
  local city = weather.city
  local icon = icon_map[weather.icon]

  if weather.icon == "clear-night" or weather.icon == "partly-cloudy-night" then
    icon = moon_phase_icon_map[moon_phase]
  end

  weather_item:set({
    icon = icon,
    label = string.format("%s - %d°C (%s)", city, feels_like, description),
    drawing = true,
  })

  weather_padding_left:set(drawing)
  weather_padding_right:set(drawing)
end

weather_watcher:subscribe("weather_changed", on_weather_changed)
weather_item:subscribe("mouse.clicked", function()
  sketchybar.exec("open -a Weather")
end)

glass.create_background("weather")
