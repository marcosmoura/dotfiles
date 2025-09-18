local glass = require("glass")
local sketchybar = require("sketchybar")

sketchybar.add("item", "menu.logo_padding", {
  label = {
    padding_left = 2,
  },
})

local apple_logo = glass.create_hoverable_item("menubar.logo", {
  icon = {
    string = "",
    padding_left = 12,
    padding_right = 12,
    color = 0xFFFFFFFF,
    align = "center",
    font = {
      style = "Black",
      size = 22.0,
    },
  },
})

apple_logo:subscribe("mouse.clicked", function()
  sketchybar.trigger("menubar_is_visible")
  sketchybar.exec("$CONFIG_DIR/menubar/scripts/bin/menu-list -a")
end)
