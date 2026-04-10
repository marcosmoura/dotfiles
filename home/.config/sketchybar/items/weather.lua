local sbar = require("sketchybar")
local colors = require("colors")
local settings = require("settings")
local hover = require("helpers.hover")

local popup_font_size = settings.popup.font_size
local popup_width = 180
local popup_content_width = popup_width - (settings.icons.width + 24)

local weather = sbar.add("item", "weather", {
  position = "right",
  icon = {
    string = settings.weather_icons.default,
  },
  label = {
    string = "--",
  },
  update_freq = 1200,
  popup = {
    drawing = false,
  },
})

-- Popup detail items
local popup_condition = sbar.add("item", "weather.popup.condition", {
  position = "popup.weather",
  width = popup_width,
  padding_left = 0,
  padding_right = 0,
  icon = {
    string = "󰖐",
    color = colors.sky,
    font = { family = settings.font.icons, style = "Bold", size = popup_font_size },
    width = settings.icons.width,
    padding_left = 8,
    padding_right = 4,
  },
  label = {
    string = "Condition: ...",
    color = colors.subtext0,
    font = { family = settings.font.text, style = "Medium", size = popup_font_size },
    width = popup_content_width,
    align = "left",
    padding_left = 4,
    padding_right = 8,
  },
})

local popup_highlow = sbar.add("item", "weather.popup.highlow", {
  position = "popup.weather",
  width = popup_width,
  padding_left = 0,
  padding_right = 0,
  icon = {
    string = "󰔏",
    color = colors.peach,
    font = { family = settings.font.icons, style = "Bold", size = popup_font_size },
    width = settings.icons.width,
    padding_left = 8,
    padding_right = 4,
  },
  label = {
    string = "H/L: ...",
    color = colors.subtext0,
    font = { family = settings.font.text, style = "Medium", size = popup_font_size },
    width = popup_content_width,
    align = "left",
    padding_left = 4,
    padding_right = 8,
  },
})

local popup_humidity = sbar.add("item", "weather.popup.humidity", {
  position = "popup.weather",
  width = popup_width,
  padding_left = 0,
  padding_right = 0,
  icon = {
    string = "󰖎",
    color = colors.blue,
    font = { family = settings.font.icons, style = "Bold", size = popup_font_size },
    width = settings.icons.width,
    padding_left = 8,
    padding_right = 4,
  },
  label = {
    string = "Humidity: ...",
    color = colors.subtext0,
    font = { family = settings.font.text, style = "Medium", size = popup_font_size },
    width = popup_content_width,
    align = "left",
    padding_left = 4,
    padding_right = 8,
  },
})

local popup_wind = sbar.add("item", "weather.popup.wind", {
  position = "popup.weather",
  width = popup_width,
  padding_left = 0,
  padding_right = 0,
  icon = {
    string = "󰖝",
    color = colors.teal,
    font = { family = settings.font.icons, style = "Bold", size = popup_font_size },
    width = settings.icons.width,
    padding_left = 8,
    padding_right = 4,
  },
  label = {
    string = "Wind: ...",
    color = colors.subtext0,
    font = { family = settings.font.text, style = "Medium", size = popup_font_size },
    width = popup_content_width,
    align = "left",
    padding_left = 4,
    padding_right = 8,
  },
})

local popup_items = {
  popup_condition,
  popup_highlow,
  popup_humidity,
  popup_wind,
}

local function update_detail(data)
  if data == nil then
    return
  end
  popup_condition:set({
    label = { string = "Condition: " .. (data.condition or "--") },
  })
  popup_highlow:set({
    label = { string = "H: " .. (data.high or "?") .. "  L: " .. (data.low or "?") },
  })
  popup_humidity:set({
    label = { string = "Humidity: " .. (data.humidity or "?") },
  })
  popup_wind:set({
    label = { string = "Wind: " .. (data.wind or "?") },
  })
end

local function update_weather()
  sbar.exec("$CONFIG_DIR/scripts/weather.sh", function(result)
    if type(result) ~= "table" then
      return
    end

    local icon_key = result.icon or "default"
    local icon = settings.weather_icons[icon_key] or settings.weather_icons.default

    local label = result.feels_like or result.temp or "--"
    if result.location and result.location ~= "" then
      label = label .. " (" .. result.location .. ")"
    end

    weather:set({
      icon = { string = icon },
      label = { string = label },
    })

    update_detail(result)
  end)
end

hover.item(weather, {
  popup = true,
  popup_items = popup_items,
})

weather:subscribe("routine", update_weather)
weather:subscribe("forced", update_weather)

update_weather()
