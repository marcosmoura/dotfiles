local glass = require("glass")
local sketchybar = require("sketchybar")

local menu_script_path = "$HOME/.config/sketchybar/apps/bin/release/app-menu"

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
      family = "SF Pro Display",
      style = "Black",
      size = 22.0,
    },
  },
})

apple_logo:subscribe("mouse.clicked", function()
  sketchybar.trigger("menubar_visibility_changed", { ['MENUBAR'] = 'true' })
  sketchybar.exec(menu_script_path .. " --show " .. 0)
end)
