local sbar = require("sketchybar")

sbar.add("alias", "Control Center,Item-0(10)", {
  position = "right",
  update_freq = 5,
  width = 34,
  icon = {
    padding_left = 0,
    padding_right = 0,
  },
  background = {
    width = 34,
    padding_right = -10,
  },
})
