local glass = require("glass")
local sketchybar = require("sketchybar")

local menu_script_path = "$CONFIG_DIR/menubar/scripts/bin/menu-list"

local menu_watcher = sketchybar.add("item", {
  drawing = false,
})

local max_items = 15
local menu_items = {}
for i = 1, max_items, 1 do
  local menu = glass.create_hoverable_item("menu." .. i, {
    drawing = false,
    icon = { drawing = false },
    label = {
      padding_left = 9,
      padding_right = 9,
    },
  })

  menu:subscribe("mouse.clicked", function()
    sketchybar.trigger("menubar_is_visible")
    sketchybar.exec(menu_script_path .. " -s " .. i)
  end)

  menu_items[i] = menu
end

local menu_padding = sketchybar.add("item", "menu.padding", {
  drawing = false,
  label = {
    padding_right = 1,
  },
})

menu_watcher:subscribe("front_app_switched", function()
  sketchybar.exec(menu_script_path .. " -l", function(menus)
    id = 1

    menu_padding:set({ drawing = true })

    for menu in string.gmatch(menus, "[^\r\n]+") do
      if id < max_items then
        menu_items[id]:set({ label = menu, drawing = true })
      else
        break
      end
      id = id + 1
    end
  end)
end)
