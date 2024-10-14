local alert = require("config.utils.alert")

local module = {}
local assets_path = "~/.config/hammerspoon/assets/"

local menubar_item = hs.menubar.new()

local update_menubar = function(show_alert)
  if menubar_item == nil then
    return
  end

  local state = hs.caffeinate.get("displayIdle")
  local icon_name = "mug" .. (state and "-filled" or "") .. ".png"
  local icon = hs.image.imageFromPath(assets_path .. icon_name)
  local message = "Caffeinate is " .. (state and "enabled" or "disabled") .. "!"

  if icon == nil then
    return
  end

  icon = icon:setSize({ w = 16, h = 16 })
  menubar_item:setIcon(icon)
  menubar_item:setTooltip(message)

  if show_alert then
    alert.custom(message, icon_name)
  end
end

local on_caffeinate = function(event)
  if event == hs.caffeinate.watcher.screensDidLock then
    hs.caffeinate.set("displayIdle", false)
  end

  if event == hs.caffeinate.watcher.screensDidUnlock then
    hs.caffeinate.set("displayIdle", true)
  end

  update_menubar(true)
end

module.start = function()
  if menubar_item == nil then
    return
  end

  menubar_item:autosaveName("caffeinate")
  menubar_item:setClickCallback(function()
    hs.caffeinate.toggle("displayIdle")
    update_menubar(true)
  end)

  hs.caffeinate.watcher.new(on_caffeinate):start()
  hs.caffeinate.set("displayIdle", true)
  update_menubar(false)
end

return module
