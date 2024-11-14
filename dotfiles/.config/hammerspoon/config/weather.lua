local colors = require("config.utils.colors")
local deepMerge = require("config.utils.deepMerge")
local memoize = require("config.utils.memoize")
local module = {}

local countryMap = {
  ["Czech Republic"] = "Czechia",
  ["United Kingdom"] = "UK",
  ["United States of America"] = "USA",
}
local weatherCodeMap = {
  ["113"] = "Sunny",
  ["116"] = "PartlyCloudy",
  ["119"] = "Cloudy",
  ["122"] = "VeryCloudy",
  ["143"] = "Fog",
  ["176"] = "LightShowers",
  ["179"] = "LightSleetShowers",
  ["182"] = "LightSleet",
  ["185"] = "LightSleet",
  ["200"] = "ThunderyShowers",
  ["227"] = "LightSnow",
  ["230"] = "HeavySnow",
  ["248"] = "Fog",
  ["260"] = "Fog",
  ["263"] = "LightShowers",
  ["266"] = "LightRain",
  ["281"] = "LightSleet",
  ["284"] = "LightSleet",
  ["293"] = "LightRain",
  ["296"] = "LightRain",
  ["299"] = "HeavyShowers",
  ["302"] = "HeavyRain",
  ["305"] = "HeavyShowers",
  ["308"] = "HeavyRain",
  ["311"] = "LightSleet",
  ["314"] = "LightSleet",
  ["317"] = "LightSleet",
  ["320"] = "LightSnow",
  ["323"] = "LightSnowShowers",
  ["326"] = "LightSnowShowers",
  ["329"] = "HeavySnow",
  ["332"] = "HeavySnow",
  ["335"] = "HeavySnowShowers",
  ["338"] = "HeavySnow",
  ["350"] = "LightSleet",
  ["353"] = "LightShowers",
  ["356"] = "HeavyShowers",
  ["359"] = "HeavyRain",
  ["362"] = "LightSleetShowers",
  ["365"] = "LightSleetShowers",
  ["368"] = "LightSnowShowers",
  ["371"] = "HeavySnowShowers",
  ["374"] = "LightSleetShowers",
  ["377"] = "LightSleet",
  ["386"] = "ThunderyShowers",
  ["389"] = "ThunderyHeavyRain",
  ["392"] = "ThunderySnowShowers",
  ["395"] = "HeavySnowShowers",
}
local iconMap = {
  Cloudy = "☁️",
  Fog = "🌫",
  HeavyRain = "🌧",
  HeavyShowers = "🌧",
  HeavySnow = "❄️",
  HeavySnowShowers = "❄️",
  LightRain = "🌦",
  LightShowers = "🌦",
  LightSleet = "🌧",
  LightSleetShowers = "🌧",
  LightSnow = "🌨",
  LightSnowShowers = "🌨",
  PartlyCloudy = "⛅️",
  Sunny = "☀️",
  ThunderyHeavyRain = "🌩",
  ThunderyShowers = "⛈",
  ThunderySnowShowers = "⛈",
  Unknown = "✨",
  VeryCloudy = "☁️",
}

local fontSize = 14
local iconFrame = 36
local spacing = 12
local padding = 4
local gap = 20

local onCanvasClick = function()
  hs.application.launchOrFocus("Weather")
end

local createCanvas = function()
  local screen = hs.screen.mainScreen()
  local screenFrame = screen:fullFrame()

  local canvasFrame = {
    x = gap,
    y = screenFrame.y + screenFrame.h - iconFrame - padding * 2 - 13,
    w = screenFrame.w / 3 + padding * 2,
    h = iconFrame + padding * 2,
  }
  local canvas = hs.canvas.new(canvasFrame)

  if not canvas then
    return nil
  end

  canvas:level(hs.canvas.windowLevels.normal - 1)
  canvas:behavior(hs.canvas.windowBehaviors.canJoinAllSpaces)
  canvas:mouseCallback(onCanvasClick)

  canvas:insertElement({
    type = "rectangle",
    action = "clip",
    trackMouseDown = true,
    roundedRectRadii = { xRadius = 8, yRadius = 8 },
  })
  canvas:insertElement({
    type = "rectangle",
    action = "fill",
    trackMouseDown = true,
    fillColor = { hex = colors.crust.hex, alpha = 0.5 },
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
    roundedRectRadii = { xRadius = 6, yRadius = 6 },
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

local mergeWithDefaultStyle = memoize(function(style)
  return deepMerge({
    font = {
      name = "Maple Mono",
      size = fontSize,
    },
    color = { hex = "#fff" },
    shadow = {
      offset = { h = -1, w = 0 },
      color = { hex = "#000", alpha = 0.4 },
      blurRadius = 2,
    },
  }, style)
end)

local getWeatherString = function(weather)
  return string.format("%s: %s (%s)", weather.location, weather.temperature, weather.condition)
end

local getWeatherStyledText = memoize(function(weather)
  local message = getWeatherString(weather)

  return hs.styledtext.new(message, mergeWithDefaultStyle({}))
end)

local getWeatherIcon = function(icon)
  local fullSize = fontSize + 8

  return hs.styledtext.new(
    icon,
    mergeWithDefaultStyle({
      font = {
        name = "Symbols Nerd Font Mono",
        size = fullSize,
      },
      textAlignment = "center",
    })
  )
end

local updateCanvas = memoize(function(canvas, weather)
  if not canvas or not weather then
    canvas:hide()
    return
  end

  local weatherText = getWeatherStyledText(weather)
  local weatherIcon = getWeatherIcon(weather.icon)

  if not weatherText or not weatherIcon then
    return
  end

  canvas[3].text = weatherText
  canvas[5].text = weatherIcon
  canvas:show()

  local textDrawing = hs.drawing.getTextDrawingSize(canvas[3].text)

  if not textDrawing then
    return
  end

  local textWidth = textDrawing.w
  local fullCanvasWidth = textWidth + iconFrame + spacing * 2 + padding
  local screenFrame = hs.screen.mainScreen():fullFrame()

  canvas[1].frame.w = fullCanvasWidth
  canvas[4].frame.x = textWidth + spacing * 2
  canvas[5].frame.x = textWidth + spacing * 2 + 6

  canvas:topLeft({
    x = screenFrame.x + screenFrame.w - fullCanvasWidth - gap,
    y = screenFrame.y + screenFrame.h - iconFrame - padding * 2 - 13,
  })
  canvas:size({
    w = fullCanvasWidth,
    h = canvas:frame().h,
  })
end)

local updateWeather = function(canvas)
  return function()
    if hs.location.servicesEnabled() and hs.location.authorizationStatus() == "authorized" then
      hs.location.start()

      local location = hs.location.get()

      if location then
        print("Current Location:")
        print("Latitude: " .. location.latitude)
        print("Longitude: " .. location.longitude)
        print("Altitude: " .. location.altitude)
        print("Horizontal Accuracy: " .. location.horizontalAccuracy)
        print("Vertical Accuracy: " .. location.verticalAccuracy)
      else
        print("Unable to retrieve location information.")
      end

      hs.location.stop()
    else
      print("Location services are not enabled.")
    end

    hs.http.asyncGet("https://wttr.in/?format=j1", nil, function(_, body)
      local response = hs.json.decode(body)

      if not response then
        return
      end

      local current = response.current_condition[1]
      local area = response.nearest_area[1]
      local country = area.country[1].value
      local weather = {
        temperature = current.FeelsLikeC .. "°C",
        condition = current.weatherDesc[1].value,
        icon = iconMap[weatherCodeMap[current.weatherCode]],
        location = area.areaName[1].value .. ", " .. (countryMap[country] or country),
      }

      print("Weather: " .. getWeatherString(weather))
      updateCanvas(canvas, weather)
    end)
  end
end

local canvas = createCanvas()
local timer = nil

module.start = function()
  local updater = updateWeather(canvas)

  -- Fetch weather every 10 minutes
  timer = hs.timer.new(10 * 60, updater)
  updater()
  timer:start()
end

return module
