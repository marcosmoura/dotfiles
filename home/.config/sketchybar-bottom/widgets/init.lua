local glass = require("glass")
local sketchybar = require("sketchybar")

local status_bar_items = {}

sketchybar.add("item", "widgets.padding.right", {
  position = "right",
  label = {
    padding_right = 1,
  },
})

for _, item in ipairs(status_bar_items) do
  glass.create_hoverable_item(item, {
    position = "right",
  }, "alias")
end

sketchybar.add("item", "widgets.padding.left", {
  position = "right",
  label = {
    padding_left = 1,
  },
})

glass.create_background("widgets")
