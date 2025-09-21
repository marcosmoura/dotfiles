local sketchybar = require("sketchybar")

sketchybar.set_bar_name("sketchybar-top")
sketchybar.begin_config()

local height = 32
local margin = 12
local total_space = height + margin

sketchybar.bar({
  height = height,
  color = 0x00000000,
  sticky = true,
  padding_right = 0,
  padding_left = 0,
  corner_radius = 32,
  margin = margin,
  y_offset = 12,
  blur_radius = 8.0,
  topmost = "window",
  font_smoothing = true,
  position = "top",
})

sketchybar.exec("yabai -m config external_bar all:" .. total_space .. ":0")

require("menubar")
require("media")
require("statusbar")

sketchybar.hotload(true)
sketchybar.end_config()
sketchybar.event_loop()
