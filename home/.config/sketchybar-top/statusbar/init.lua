local glass = require("glass")
local sketchybar = require("sketchybar")

local status_bar_items = {
  "Control Center,Clock",
  "Control Center,Battery_battery",
  "Control Center,WiFi",
  "Control Center,Bluetooth",
  "Control Center,Sound",
  "Control Center,caffeinate",
  "Control Center,CPU_mini",
  "Control Center,Sensors_mini",
}

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
