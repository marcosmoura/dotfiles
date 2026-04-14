local sbar = require("sketchybar")
local colors = require("colors")
local icons = require("icons")
local hover = require("helpers.hover")
local popup = require("helpers.popup")

local popup_width = 180

local battery = sbar.add("item", "battery", {
  position = "right",
  icon = {
    string = icons.battery.full,
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

local popup_row_specs = {
  { key = "health", icon = icons.battery_popup.health, icon_color = colors.green, label = "Health: ..." },
  { key = "cycles", icon = icons.battery_popup.cycles, icon_color = colors.blue, label = "Cycles: ..." },
  { key = "temp", icon = icons.battery_popup.temperature, icon_color = colors.peach, label = "Temp: ..." },
  { key = "remaining", icon = icons.battery_popup.time, icon_color = colors.lavender, label = "Time: ..." },
}
local popup_items = {}
local popup_rows = {}

for _, row in ipairs(popup_row_specs) do
  local item = popup.create_row("battery.popup." .. row.key, "battery", {
    width = popup_width,
    icon = row.icon,
    icon_color = row.icon_color,
    label = row.label,
  })
  popup_items[#popup_items + 1] = item
  popup_rows[row.key] = item
end

local function get_battery_icon(percentage, state)
  if state == "charging" then
    return icons.battery.charging
  end
  if percentage == 100 then
    return icons.battery.full
  end
  if percentage >= 75 then
    return icons.battery.medium_high
  end
  if percentage >= 50 then
    return icons.battery.medium
  end
  if percentage >= 25 then
    return icons.battery.low
  end

  return icons.battery.empty
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

    popup_rows.health:set({
      label = { string = "Health: " .. (result.health or "--") },
    })
    popup_rows.cycles:set({
      label = { string = "Cycles: " .. (result.cycles or "--") },
    })
    popup_rows.temp:set({
      label = { string = "Temp: " .. (result.temp or "--") },
    })
    popup_rows.remaining:set({
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
    local icon = get_battery_icon(percent, state)
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
