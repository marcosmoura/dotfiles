local sbar = require("sketchybar")
local colors = require("colors")
local settings = require("settings")
local hover = require("helpers.hover")

local popup_font_size = settings.popup.font_size or 15.0
local popup_width = 180
local popup_content_width = popup_width - (settings.icons.width + 24)

local battery = sbar.add("item", "battery", {
  position = "right",
  icon = {
    string = settings.battery_icons.full,
    color = colors.green,
  },
  label = {
    string = "--%",
  },
  update_freq = 60,
  popup = {
    drawing = false,
  },
})

-- Popup detail items
local popup_health = sbar.add("item", "battery.popup.health", {
  position = "popup.battery",
  width = popup_width,
  padding_left = 0,
  padding_right = 0,
  icon = {
    string = "󰓐",
    color = colors.green,
    width = settings.icons.width,
    padding_left = 8,
    padding_right = 4,
  },
  label = {
    string = "Health: ...",
    color = colors.subtext0,
    font = { family = settings.font.text, style = "Medium", size = popup_font_size },
    width = popup_content_width,
    align = "left",
    padding_left = 4,
    padding_right = 8,
  },
})

local popup_cycles = sbar.add("item", "battery.popup.cycles", {
  position = "popup.battery",
  width = popup_width,
  padding_left = 0,
  padding_right = 0,
  icon = {
    string = "󰑓",
    color = colors.blue,
    width = settings.icons.width,
    padding_left = 8,
    padding_right = 4,
  },
  label = {
    string = "Cycles: ...",
    color = colors.subtext0,
    font = { family = settings.font.text, style = "Medium", size = popup_font_size },
    width = popup_content_width,
    align = "left",
    padding_left = 4,
    padding_right = 8,
  },
})

local popup_temp = sbar.add("item", "battery.popup.temp", {
  position = "popup.battery",
  width = popup_width,
  padding_left = 0,
  padding_right = 0,
  icon = {
    string = "󰔏",
    color = colors.peach,
    width = settings.icons.width,
    padding_left = 8,
    padding_right = 4,
  },
  label = {
    string = "Temp: ...",
    color = colors.subtext0,
    font = { family = settings.font.text, style = "Medium", size = popup_font_size },
    width = popup_content_width,
    align = "left",
    padding_left = 4,
    padding_right = 8,
  },
})

local popup_remaining = sbar.add("item", "battery.popup.remaining", {
  position = "popup.battery",
  width = popup_width,
  padding_left = 0,
  padding_right = 0,
  icon = {
    string = "󰥔",
    color = colors.lavender,
    width = settings.icons.width,
    padding_left = 8,
    padding_right = 4,
  },
  label = {
    string = "Time: ...",
    color = colors.subtext0,
    font = { family = settings.font.text, style = "Medium", size = popup_font_size },
    width = popup_content_width,
    align = "left",
    padding_left = 4,
    padding_right = 8,
  },
})

local popup_items = {
  popup_health,
  popup_cycles,
  popup_temp,
  popup_remaining,
}

local function get_battery_icon(percentage, charging)
  if charging then
    return settings.battery_icons.charging
  end

  local levels = settings.battery_icons.level
  local index = math.max(1, math.ceil(percentage / 10))
  return levels[index] or settings.battery_icons.full
end

local function get_battery_color(percentage, charging)
  if charging then
    return colors.green
  end
  if percentage < 25 then
    return colors.red
  elseif percentage < 65 then
    return colors.yellow
  end
  return colors.green
end

local function update_detail()
  sbar.exec("$CONFIG_DIR/scripts/battery.sh --detail", function(result)
    if type(result) ~= "table" then
      return
    end

    local state = result.state or ""
    local remaining_label = "Time: " .. (result.time_remaining or "--")
    if state == "charging" then
      remaining_label = "To finish charge: " .. (result.time_remaining or "--")
    elseif state == "discharging" then
      remaining_label = "To empty: " .. (result.time_remaining or "--")
    elseif state == "full" then
      remaining_label = "Fully charged"
    end

    popup_health:set({
      label = { string = "Health: " .. (result.health or "--") },
    })
    popup_cycles:set({
      label = { string = "Cycles: " .. (result.cycles or "--") },
    })
    popup_temp:set({
      label = { string = "Temp: " .. (result.temp or "--") },
    })
    popup_remaining:set({
      label = { string = remaining_label },
    })
  end)
end

local function update_battery()
  sbar.exec("$CONFIG_DIR/scripts/battery.sh", function(result)
    if type(result) ~= "table" then
      return
    end

    local percent = tonumber(result.percentage) or 0
    local state = result.state or ""
    local charging = state == "charging"
    local icon = get_battery_icon(percent, charging)
    local color = get_battery_color(percent, charging)
    local label = string.format("%.0f%%", percent)
    if charging then
      label = label .. " (Charging)"
    end

    sbar.animate("tanh", 15, function()
      battery:set({
        icon = { string = icon, color = color },
        label = { string = label },
      })
    end)
  end)
end

hover.item(battery, {
  popup = true,
  before_toggle = update_detail,
  popup_items = popup_items,
})

battery:subscribe("routine", update_battery)
battery:subscribe("forced", update_battery)
battery:subscribe("power_source_change", update_battery)
battery:subscribe("system_woke", update_battery)

update_battery()
