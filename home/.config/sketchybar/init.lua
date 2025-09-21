local sketchybar = require("sketchybar")

sketchybar.begin_config()

-- kill existing bars if any
os.execute("killall sketchybar-top")
os.execute("killall sketchybar-bottom")

-- start bars
os.execute("sketchybar-top &")
os.execute("sketchybar-bottom &")

-- configure this invisible default bar
sketchybar.bar({
  height = 0,
  color = 0x00000000,
  display = "none",
})

sketchybar.hotload(true)
sketchybar.end_config()
sketchybar.event_loop()
