local glass = require("glass")
local sketchybar = require("sketchybar")

require("menubar.logo")
require("menubar.menu")

local menubar_watcher = sketchybar.add("item", "menubar.watcher", {
  drawing = false,
})

sketchybar.add("event", "menubar_is_visible")
sketchybar.add("event", "menubar_is_hidden")

menubar_watcher:subscribe("menubar_is_visible", function()
  sketchybar.animate("tanh", 10, function()
    sketchybar.bar({
      y_offset = -44,
    })
  end)
end)

menubar_watcher:subscribe("menubar_is_hidden", function()
  sketchybar.animate("tanh", 10, function()
    sketchybar.bar({
      y_offset = 12,
    })
  end)
end)

glass.create_background("menu")
