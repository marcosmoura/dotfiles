local sketchybar = require("sketchybar")

sketchybar.begin_config()

-- configure this invisible default bar
sketchybar.bar({
  height = 0,
  color = 0x00000000,
  hidden = true,
})

sketchybar.hotload(false)
sketchybar.end_config()
sketchybar.event_loop()
