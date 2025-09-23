local glass = require("glass")
local sketchybar = require("sketchybar")

local status_bar_items = {
  "Control Center,WiFi",
  "Control Center,Bluetooth",
  "Control Center,Sound",
  "Control Center,caffeinate",
}

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

sketchybar.add("item", "spacer.statusbar.control-center", {
  position = "right",
  label = {
    padding_left = 2,
  },
})

sketchybar.add("item", "Control Center.padding.right", {
  position = "right",
  label = {
    padding_right = 1,
  },
})

for _, item in ipairs(status_bar_items) do
  glass.create_hoverable_item(item, {
    position = "right",
    alias = {
      color = "0xaaffffff",
    }
  }, "alias")
end

sketchybar.add("item", "Control Center.padding.left", {
  position = "right",
  label = {
    padding_left = 1,
  },
})

glass.create_background("Control Center")
