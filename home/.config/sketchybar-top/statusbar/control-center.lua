local glass = require("glass")
local sketchybar = require("sketchybar")

local keys = {
  "Control Center,WiFi",
  "Control Center,Bluetooth",
  "Control Center,Sound",
  "Control Center,FocusModes",
  "Control Center,caffeinate",
}
local items = {}
local is_items_visible = true

local get_control_icon = function()
  if is_items_visible then
    return "􀆊"
  else
    return "􀆉"
  end
end

sketchybar.add("item", "Control Center.padding.right", {
  position = "right",
  label = {
    padding_right = 1,
  },
})

local control = glass.create_hoverable_item('Control Center.action_button', {
  position = "right",
  icon = {
    string = get_control_icon(),
    padding_left = 12,
    padding_right = 12,
    color = 0xFFFFFFFF,
    align = "center",
    font = {
      family = "SF Pro",
      size = 14.0,
    },
  },
})

for _, key in ipairs(keys) do
  local item = glass.create_hoverable_item(key, {
    position = "right",
    drawing = is_items_visible,
    alias = {
      color = "0xaaffffff",
    }
  }, "alias")

  table.insert(items, item)
end

sketchybar.add("item", "Control Center.padding.left", {
  position = "right",
  label = {
    padding_left = 1,
  },
})

control:subscribe("mouse.clicked", function()
  is_items_visible = not is_items_visible

  for _, item in ipairs(items) do
    glass.animate_item(item, {
      drawing = is_items_visible
    })
  end

  glass.animate_item(control, {
    icon = { string = get_control_icon() }
  })
end)

glass.create_background("Control Center")
