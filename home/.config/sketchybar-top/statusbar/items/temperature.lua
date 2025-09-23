local sketchybar = require("sketchybar")
local inspect = require("inspect")
local glass = require("glass")

local temperature = glass.create_hoverable_item("statusbar.temperature", {
  position = "right",
  drawing = false,
  icon = {
    string = "􀧓 ",
    font = {
      family = "SF Symbols",
      size = 18,
    },
    padding_left = 9,
    padding_right = 0,
  },
  label = {
    padding_left = 9,
    padding_right = 9,
  },
})

local temperature_icons = {
  "􂬮 ", -- default
  "􁏃 ", -- low
  "􀇬 ", -- medium
  "􁏄 ", -- high
}

local get_temperature_icon = function(temperature)
  if temperature <= 60 then
    return temperature_icons[2]
  elseif temperature <= 70 then
    return temperature_icons[3]
  elseif temperature > 70 then
    return temperature_icons[4]
  end

  return temperature_icons[1]
end

local on_cpu_changed = function(env)
  local cpu_data = env.CPU

  if not cpu_data then
    return
  end

  temperature:set({
    drawing = true,
    icon = {
      string = get_temperature_icon(cpu_data.temperature),
    },
    label = {
      string = cpu_data.temperature .. "°C"
    },
  })
end

sketchybar.exec("$HOME/.config/sketchybar/apps/bin/release/cpu-watcher --get")

temperature:subscribe("cpu_changed", on_cpu_changed)
