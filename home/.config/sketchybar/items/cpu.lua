local sbar = require("sketchybar")
local colors = require("colors")
local icons = require("icons")

local cpu = sbar.add("item", "cpu", {
  position = "right",
  icon = {
    string = icons.status.cpu,
  },
  label = {
    string = "--%",
  },
  update_freq = 5,
})

local function get_color(usage)
  if usage >= 80 then
    return colors.red
  elseif usage >= 50 then
    return colors.yellow
  else
    return colors.text
  end
end

local function get_temperature_value(raw_temperature)
  if type(raw_temperature) ~= "string" then
    return nil
  end

  return tonumber(raw_temperature:match("([%d%.]+)"))
end

local function update_cpu()
  sbar.exec("$CONFIG_DIR/scripts/cpu.sh --summary", function(result)
    local usage = tonumber(result and result.usage) or tonumber(result)
    if usage == nil then
      return
    end

    local temperature = get_temperature_value(result and result.temperature)
    local is_hot = temperature ~= nil and temperature >= 85
    local icon = is_hot and icons.status.cpu_hot or icons.status.cpu

    sbar.animate("tanh", 15, function()
      cpu:set({
        icon = { string = icon, color = is_hot and colors.red or get_color(usage) },
        label = { string = string.format("%.0f%%", usage) },
      })
    end)
  end)
end

cpu:subscribe("routine", update_cpu)
cpu:subscribe("forced", update_cpu)
cpu:subscribe("system_woke", update_cpu)

update_cpu()
