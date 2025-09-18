local sketchybar = require("sketchybar")

sketchybar.set_bar_name("sketchybar-bottom")
sketchybar.begin_config()

sketchybar.bar({
  height = 32,
  color = 0x00000000,
  sticky = true,
  padding_right = 0,
  padding_left = 0,
  margin = 12,
  blur_radius = 8.0,
  font_smoothing = true,
  y_offset = 8,
  topmost = "window",
  position = "bottom",
  display = "main",
})

require("spaces")

sketchybar.hotload(true)
sketchybar.end_config()
sketchybar.event_loop()
