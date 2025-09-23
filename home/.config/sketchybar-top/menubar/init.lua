local glass = require("glass")
local sketchybar = require("sketchybar")

require("menubar.logo")
require("menubar.menu")

local menubar_watcher = sketchybar.add("item", "menubar.watcher", {
  drawing = false,
})

menubar_watcher:subscribe("menubar_visibility_changed", function(env)
  local is_hidden = env.MENUBAR == 'true' and true or false
  local position = is_hidden and -44 or 12

  sketchybar.animate("tanh", 10, function()
    sketchybar.bar({
      y_offset = position,
    })
  end)
end)

glass.create_background("menu")
