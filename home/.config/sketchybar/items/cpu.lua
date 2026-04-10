local sbar = require("sketchybar")
local colors = require("colors")

local cpu = sbar.add("item", "cpu", {
  position = "right",
  icon = {
    string = "󰍛",
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

local function update_cpu()
  sbar.exec("$CONFIG_DIR/scripts/cpu.sh", function(result)
    local usage = tonumber(result)
    if usage == nil then
      return
    end

    sbar.animate("tanh", 15, function()
      cpu:set({
        icon = { color = get_color(usage) },
        label = { string = string.format("%.0f%%", usage) },
      })
    end)
  end)
end

cpu:subscribe("routine", update_cpu)
cpu:subscribe("forced", update_cpu)
cpu:subscribe("system_woke", update_cpu)

update_cpu()
