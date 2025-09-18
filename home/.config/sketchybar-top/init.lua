local sketchybar = require("sketchybar")

sketchybar.set_bar_name("sketchybar-top")
sketchybar.begin_config()

sketchybar.bar({
  height = 32,
  color = 0x00000000,
  sticky = true,
  padding_right = 0,
  padding_left = 0,
  corner_radius = 32,
  margin = 12,
  y_offset = 12,
  blur_radius = 8.0,
  topmost = "window",
  font_smoothing = true,
  position = "top",
})

local bar_watcher = sketchybar.add("item", "menubar_watcher", {
  drawing = false,
})

sketchybar.add("event", "menubar_is_visible")
sketchybar.add("event", "menubar_is_hidden")

bar_watcher:subscribe("menubar_is_visible", function()
  sketchybar.animate("tanh", 10, function()
    sketchybar.bar({
      y_offset = -44,
    })
  end)
end)

bar_watcher:subscribe("menubar_is_hidden", function()
  sketchybar.animate("tanh", 10, function()
    sketchybar.bar({
      y_offset = 12,
    })
  end)
end)

require("menubar")
require("media")
require("statusbar")

sketchybar.hotload(true)
sketchybar.end_config()
sketchybar.event_loop()
