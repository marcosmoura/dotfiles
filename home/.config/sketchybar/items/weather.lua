local sbar = require("sketchybar")
local colors = require("colors")
local icons = require("icons")
local hover = require("helpers.hover")
local popup = require("helpers.popup")

local popup_width = 180

local weather = sbar.add("item", "weather", {
  position = "right",
  icon = {
    string = icons.weather.default,
  },
  label = {
    string = "--",
  },
  update_freq = 1200,
  popup = {
    drawing = false,
  },
})

local popup_row_specs = {
  { key = "condition", icon = icons.weather.default, icon_color = colors.sky, label = "Condition: ..." },
  { key = "highlow", icon = icons.weather_popup.temperature, icon_color = colors.peach, label = "H/L: ..." },
  { key = "humidity", icon = icons.weather_popup.humidity, icon_color = colors.blue, label = "Humidity: ..." },
  { key = "wind", icon = icons.weather_popup.wind, icon_color = colors.teal, label = "Wind: ..." },
}
local popup_items = {}
local popup_rows = {}

for _, row in ipairs(popup_row_specs) do
  local item = popup.create_row("weather.popup." .. row.key, "weather", {
    width = popup_width,
    icon = row.icon,
    icon_color = row.icon_color,
    label = row.label,
  })
  popup_items[#popup_items + 1] = item
  popup_rows[row.key] = item
end

local legacy_icon_keys = {
  clear = "clearDay",
  cloudy = "cloudy",
  rainy = "rain",
  snowy = "snow",
  stormy = "thunder",
  foggy = "fog",
  default = "clearDay",
}

local function get_weather_icon(icon_key)
  local key = icon_key or "default"
  local normalized_key = legacy_icon_keys[key] or key

  return icons.weather[normalized_key] or icons.weather.default
end

local function update_detail(data, condition_icon)
  if data == nil then
    return
  end

  popup_rows.condition:set({
    icon = { string = condition_icon },
    label = { string = "Condition: " .. (data.condition or "--") },
  })
  popup_rows.highlow:set({
    label = { string = "H: " .. (data.high or "?") .. "  L: " .. (data.low or "?") },
  })
  popup_rows.humidity:set({
    label = { string = "Humidity: " .. (data.humidity or "?") },
  })
  popup_rows.wind:set({
    label = { string = "Wind: " .. (data.wind or "?") },
  })
end

local function update_weather()
  sbar.exec("$CONFIG_DIR/scripts/weather.sh", function(result)
    if type(result) ~= "table" then
      return
    end

    local icon = get_weather_icon(result.icon)

    local label = result.feels_like or result.temp or "--"
    if result.location and result.location ~= "" then
      label = label .. " (" .. result.location .. ")"
    end

    weather:set({
      icon = { string = icon },
      label = { string = label },
    })

    update_detail(result, icon)
  end)
end

hover.item(weather, {
  popup = true,
  popup_items = popup_items,
})

weather:subscribe("routine", update_weather)
weather:subscribe("forced", update_weather)

update_weather()
