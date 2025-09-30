local glass = require("glass")
local sketchybar = require("sketchybar")

sketchybar.add("item", "statusbar.padding.right", {
  position = "right",
  label = {
    padding_right = 1,
  },
})

require("statusbar.items.clock")
require("statusbar.items.battery")
require("statusbar.items.temperature")
require("statusbar.items.cpu")

sketchybar.add("item", "statusbar.padding.left", {
  position = "right",
  label = {
    padding_left = 1,
  },
})

glass.create_background("statusbar")

sketchybar.add("item", "spacer.statusbar", {
  position = "right",
  label = {
    padding_left = 2,
  },
})

require("statusbar.control-center")
