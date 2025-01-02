local colors = require("config.utils.colors")
local memoize = require("config.utils.memoize")
local widgets = require("config.utils.widgets")

local iconMap = {
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

local moonPhaseIconMap = {
  newMoon = "🌑",
  waxingCrescent = "🌒",
  firstQuarter = "🌓",
  waxingGibbous = "🌔",
  fullMoon = "🌕",
  waningGibbous = "🌖",
  lastQuarter = "🌗",
  waningCrescent = "🌘",
  unknown = "🌚",
}

--- @alias MoonPhase "newMoon" | "waxingCrescent" | "firstQuarter" | "waxingGibbous" | "fullMoon" | "waningGibbous" | "lastQuarter" | "waningCrescent" | "unknown"

--- @class Weather
--- @field temperature string
--- @field condition string
--- @field moonPhase number
--- @field location string
--- @field icon string

--- @class LocationTable - a table specifying location coordinates containing one or more of the following key-value pairs
--- @field latitude number - a number specifying the latitude in degrees. Positive values indicate latitudes north of the equator. Negative values indicate latitudes south of the equator. When not specified in a table being used as an argument, this defaults to 0.0.
--- @field longitude number - a number specifying the longitude in degrees. Measurements are relative to the zero meridian, with positive values extending east of the meridian and negative values extending west of the meridian. When not specified in a table being used as an argument, this defaults to 0.0.
--- @field altitude number - a number indicating altitude above (positive) or below (negative) sea-level. When not specified in a table being used as an argument, this defaults to 0.0.
--- @field horizontalAccuracy number - a number specifying the radius of uncertainty for the location, measured in meters. If negative, the `latitude` and `longitude` keys are invalid and should not be trusted. When not specified in a table being used as an argument, this defaults to 0.0.
--- @field verticalAccuracy number - a number specifying the accuracy of the altitude value in meters. If negative, the `altitude` key is invalid and should not be trusted. When not specified in a table being used as an argument, this defaults to -1.0.
--- @field course number - a number specifying the direction in which the device is traveling. If this value is negative, then the value is invalid and should not be trusted. On current Macintosh models, this will almost always be a negative number. When not specified in a table being used as an argument, this defaults to -1.0.
--- @field speed number - a number specifying the instantaneous speed of the device in meters per second. If this value is negative, then the value is invalid and should not be trusted. On current Macintosh models, this will almost always be a negative number. When not specified in a table being used as an argument, this defaults to -1.0.
--- @field timestamp number - a number specifying the time at which this location was determined. This number is the number of seconds since January 1, 1970 at midnight, GMT, and is a floating point number, so you should use `math.floor` on this number before using it as an argument to Lua's `os.date` function. When not specified in a table being used as an argument, this defaults to the current time.

--- @class Geocoder
--- @field name string - a string containing the name of the location, if known.
--- @field timezone string - a string containing the timezone identifier for the location, if known.
--- @field countryCode string - a string containing the ISO 3166-1 alpha-2 country code for the location, if known.
--- @field country string - a string containing the name of the country for the location, if known.
--- @field administrativeArea string - a string containing the name of the administrative area for the location, if known.
--- @field subAdministrativeArea string - a string containing the name of the sub-administrative area for the location, if known.
--- @field locality string - a string containing the name of the locality for the location, if known.
--- @field subLocality string - a string containing the name of the sub-locality for the location, if known.

--- Get the moon phase name based on the phase
--- @param phase number
--- @return MoonPhase
local getMoonPhaseName = function(phase)
  if phase >= 0 and phase < 0.25 then
    return "newMoon"
  elseif phase >= 0.25 and phase < 0.5 then
    return "waxingCrescent"
  elseif phase == 0.25 then
    return "firstQuarter"
  elseif phase >= 0.5 and phase < 0.75 then
    return "waxingGibbous"
  elseif phase == 0.5 then
    return "fullMoon"
  elseif phase >= 0.75 and phase < 1 then
    return "waningGibbous"
  elseif phase == 0.75 then
    return "lastQuarter"
  elseif phase >= 0.75 and phase <= 1 then
    return "waningCrescent"
  end

  return "unknown"
end

local fontSize = 13
local iconFrame = 36
local spacing = 12
local padding = 4
local gap = 20

local defaultLatLong = {
  latitude = 50.077152249886,
  longitude = 14.441415779226,
}
local apiKeysPath = "~/.config/hammerspoon/api_keys.json"
local canvas = nil
local currentLocation = {}
local canvasUpdateTimer = nil
local locationUpdateTimer = nil
local screenWatcher = nil

--- Focus the Weather app when the canvas is clicked
local onCanvasClick = function()
  hs.application.launchOrFocus("Weather")
end

--- Get the screen frame
local getScreenFrame = function()
  return hs.screen.primaryScreen():fullFrame()
end

--- Create the weather canvas
--- @return hs.canvas
local createCanvas = function()
  local screenFrame = getScreenFrame()
  local canvasFrame = {
    x = gap,
    y = screenFrame.y + screenFrame.h - iconFrame - padding * 2 - 14,
    w = screenFrame.w / 3 + padding * 2,
    h = iconFrame + padding * 2,
  }
  local canvas = widgets.create(canvasFrame, onCanvasClick)

  canvas:insertElement({
    type = "rectangle",
    action = "clip",
    trackMouseDown = true,
    roundedRectRadii = { xRadius = 9, yRadius = 9 },
  })
  canvas:insertElement({
    type = "rectangle",
    action = "fill",
    trackMouseDown = true,
    fillColor = { hex = colors.crust.hex, alpha = 0.625 },
  })
  canvas:insertElement({
    type = "text",
    trackMouseDown = true,
    frame = {
      x = spacing,
      y = (iconFrame - fontSize) / 2 + padding - 2,
      w = canvasFrame.w - (iconFrame + spacing + padding),
      h = "100%",
    },
  })
  canvas:insertElement({
    type = "rectangle",
    action = "fill",
    trackMouseDown = true,
    roundedRectRadii = { xRadius = 7, yRadius = 7 },
    fillColor = { hex = colors.crust.hex, alpha = 0.325 },
    frame = {
      w = iconFrame,
      h = iconFrame,
      x = padding,
      y = padding,
    },
  })
  canvas:insertElement({
    type = "text",
    trackMouseDown = true,
    frame = {
      w = iconFrame,
      h = iconFrame,
      x = 10,
      y = 12,
    },
  })
  canvas:insertElement({
    type = "resetClip",
    trackMouseDown = true,
  })

  return canvas
end

--- Get the weather string
--- @param weather Weather
local getWeatherString = function(weather)
  return string.format("%s: %s (%s)", weather.location, weather.temperature, weather.condition)
end

local getWeatherStyledText = memoize(function(weather)
  local message = getWeatherString(weather)

  return hs.styledtext.new(message, widgets.getTextStyle({}))
end)

local getNoWeatherStyledText = memoize(function(message)
  return hs.styledtext.new(message, widgets.getTextStyle({}))
end)

--- Get weather icon
--- @param icon string
--- @return hs.styledtext|nil
local getWeatherIcon = function(icon)
  local fullSize = fontSize + 8

  return hs.styledtext.new(
    icon,
    widgets.getTextStyle({
      font = {
        name = "Symbols Nerd Font Mono",
        size = fullSize,
      },
      textAlignment = "center",
    })
  )
end

--- Update the canvas
--- @param canvas hs.canvas
--- @param weather Weather
local updateCanvas = memoize(function(canvas, weather)
  if not canvas then
    canvas:hide()
    return
  end

  local weatherText = weather and getWeatherStyledText(weather) or getNoWeatherStyledText("No weather available! :(")
  local weatherIcon = weather and getWeatherIcon(weather.icon) or "🌚"

  if not weatherText or not weatherIcon then
    return
  end

  canvas[3].text = weatherText
  canvas[5].text = weatherIcon

  local textDrawing = hs.drawing.getTextDrawingSize(canvas[3].text)

  if not textDrawing then
    return
  end

  local textWidth = textDrawing.w
  local fullCanvasWidth = textWidth + iconFrame + spacing * 2 + padding
  local screenFrame = getScreenFrame()

  canvas[1].frame.w = fullCanvasWidth
  canvas[4].frame.x = textWidth + spacing * 2
  canvas[5].frame.x = textWidth + spacing * 2 + 6

  canvas:topLeft({
    x = screenFrame.x + screenFrame.w - fullCanvasWidth - gap + padding / 2,
    y = screenFrame.y + screenFrame.h - iconFrame - padding * 2 - 13,
  })

  local canvasFrame = canvas:frame()

  if not canvasFrame then
    return
  end

  canvas:size({
    w = fullCanvasWidth,
    h = canvasFrame.h,
  })
  canvas:show()
end)

--- Set the current location
--- @param location LocationTable|nil
local setLocation = function(location)
  if location then
    currentLocation = location
  else
    currentLocation = {}
  end

  if DEBUG then
    print("Current Location:")
    print("Latitude: " .. (currentLocation.latitude or "N/A"))
    print("Longitude: " .. (currentLocation.longitude or "N/A"))
    print("Altitude: " .. (currentLocation.altitude or "N/A"))
    print("Horizontal Accuracy: " .. (currentLocation.horizontalAccuracy or "N/A"))
    print("Vertical Accuracy: " .. (currentLocation.verticalAccuracy or "N/A"))
  end
end

--- Update the location
local updateLocation = function()
  if hs.location.servicesEnabled() and hs.location.authorizationStatus() == "authorized" then
    setLocation(hs.location.get())
  else
    print("Location services are not enabled.")
  end
end

--- Set the location watcher
--- @param updateWeather function
local setLocationWatcher = function(updateWeather)
  hs.location.start()

  local location = hs.location.get()

  setLocation(location)

  if not location then
    hs.timer.doAfter(0.1, function()
      -- Force a location update
      if DEBUG then
        print("Forcing location update")
      end

      hs.wifi.availableNetworks()
    end)
  end

  hs.location.register("weather-tracker", function(location)
    setLocation(location)
    updateWeather()
  end, 100)
end

--- Get the weather API URL
--- @param location LocationTable
--- @return string|nil
local getWeatherApiUrl = function(location)
  if not hs.fs.attributes(apiKeysPath) then
    hs.json.write(apiKeysPath, {})
    print("Please add your API keys to " .. apiKeysPath)

    return
  end

  local apiKeys = hs.json.read(apiKeysPath) or {}
  local url = string.format(
    "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/%s,%s/today?key=%s",
    location.latitude,
    location.longitude,
    apiKeys.visualCrossing
  )

  local args = {
    unitGroup = "metric",
    elements = "name,address,resolvedAddress,feelslike,moonphase,conditions,description,icon",
    include = "alerts,current,fcst,days",
    iconSet = "icons2",
    contentType = "json",
  }

  for key, value in pairs(args) do
    url = url .. "&" .. key .. "=" .. value
  end

  return url
end

--- Fetch the weather
--- @param location LocationTable
--- @param geocoder Geocoder|nil
local fetch = function(location, geocoder)
  hs.http.asyncGet(getWeatherApiUrl(location), nil, function(_, body)
    if not body then
      return
    end

    local response = hs.json.decode(body)

    if not response then
      return
    end

    local moonPhase = getMoonPhaseName(response.currentConditions.moonphase)
    local iconName = response.currentConditions.icon
    local icon = iconMap[iconName]

    if iconName == "clear-night" or iconName == "partly-cloudy-night" then
      icon = moonPhaseIconMap[moonPhase]
    end

    updateCanvas(canvas, {
      temperature = math.ceil(response.days[1].feelslike) .. "°C",
      condition = response.currentConditions.conditions,
      moonPhase = response.currentConditions.moonphase,
      location = geocoder and (geocoder.name or hs.fnutils.split(geocoder.timezone, "/")[2]),
      icon = icon,
    })
  end)
end

--- Update the weather canvas
local updateWeatherCanvas = function()
  if not (currentLocation.latitude and currentLocation.longitude) then
    fetch(defaultLatLong, nil)
    return
  end

  hs.location.geocoder.lookupLocation(currentLocation, function(status, results)
    if not (status and results) then
      fetch(defaultLatLong, nil)
      return
    end

    fetch(currentLocation, results[1])
  end)
end

local module = {}

module.start = function()
  canvas = createCanvas()

  -- Fetch location every minute
  locationUpdateTimer = hs.timer.new(60, updateLocation)

  -- Fetch weather every 10 minutes
  canvasUpdateTimer = hs.timer.new(10 * 60, updateWeatherCanvas)

  -- Watch for screen changes
  screenWatcher = hs.screen.watcher.newWithActiveScreen(updateWeatherCanvas):start()

  -- Start watchers and update weather canvas
  canvasUpdateTimer:start()
  locationUpdateTimer:start()
  screenWatcher:start()
  setLocationWatcher(updateWeatherCanvas)
end

return module
