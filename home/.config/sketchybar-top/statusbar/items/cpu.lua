local sketchybar = require("sketchybar")
local glass = require("glass")

local cpu = glass.create_hoverable_item("statusbar.cpu", {
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

local on_cpu_changed = function(env)
  local cpu_data = env.CPU

  if not cpu_data then
    return
  end

  cpu:set({
    drawing = true,
    label = {
      string = cpu_data.percentage .. "%",
    },
  })
end

sketchybar.exec("$HOME/.config/sketchybar/apps/bin/release/cpu-watcher --get")

cpu:subscribe("cpu_changed", on_cpu_changed)
