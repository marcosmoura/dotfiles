local sketchybar = require("sketchybar")
local inspect = require("inspect")
local glass = require("glass")

local battery = glass.create_hoverable_item("statusbar.battery", {
  position = "right",
  drawing = false,
  icon = {
    font = {
      family = "Maple Mono NF",
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

local get_battery_status = function(battery_data)
  if battery_data.status == "charging" or battery_data.status == "discharging" then
    return '(' .. battery_data.time_remaining .. ')'
  end

  return ""
end

local battery_icons = {
  ["0"] = "󰂎 ",
  ["10"] = "󰁺 ",
  ["20"] = "󰁻 ",
  ["30"] = "󰁼 ",
  ["40"] = "󰁽 ",
  ["50"] = "󰁾 ",
  ["60"] = "󰁿 ",
  ["70"] = "󰂀 ",
  ["80"] = "󰂁 ",
  ["90"] = "󰂂 ",
  ["100"] = "󰁹 ",
  full = "󰁹 ",

  charging_0 = "󰢟 ",
  charging_10 = "󰢜 ",
  charging_20 = "󰢝 ",
  charging_30 = "󰂇 ",
  charging_40 = "󰂈 ",
  charging_50 = "󰢝 ",
  charging_60 = "󰂉 ",
  charging_70 = "󰢞 ",
  charging_80 = "󰂊 ",
  charging_90 = "󰂋 ",
  charging_100 = "󰂅 ",

}

local get_battery_icon = function(battery_data)
  local icon = battery_icons.full

  if battery_data.status == "discharging" then
    local level_key = tostring(math.floor(battery_data.level / 10) * 10)
    icon = battery_icons[level_key] or icon
  elseif battery_data.status == "charging" then
    local level_key = "charging_" .. tostring(math.floor(battery_data.level / 10) * 10)
    icon = battery_icons[level_key] or icon
  end

  return icon
end

local on_battery_changed = function(env)
  local battery_data = env.BATTERY

  if not battery_data then
    return
  end

  battery:set({
    drawing = true,
    icon = {
      string = get_battery_icon(battery_data)
    },
    label = {
      string = string.format("%d%% %s", battery_data.level, get_battery_status(battery_data))
    },
  })
end

sketchybar.exec("$HOME/.config/sketchybar/apps/bin/release/battery-watcher --get")

battery:subscribe("battery_level_changed", on_battery_changed)
