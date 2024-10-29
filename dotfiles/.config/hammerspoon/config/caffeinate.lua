local alert = require("config.utils.alert")
local assets = require("config.utils.assets")

local module = {}
local assets_path = "~/.config/hammerspoon/assets/"

local menubar_item = hs.menubar.new()

local update_menubar = function(show_alert)
  if menubar_item == nil then
    return
  end

  local state = hs.caffeinate.get("displayIdle")
  local menubar_icon = state and assets.mugFilledSmall or assets.mugSmall
  local message = "Caffeinate is " .. (state and "enabled" or "disabled") .. "!"

  menubar_item:setIcon(menubar_icon)
  menubar_item:setTooltip(message)

  if show_alert then
    local alert_icon = state and assets.mugFilled or assets.mug

    alert.custom(message, alert_icon)
  end
end

local on_caffeinate = function(event)
  if event == hs.caffeinate.watcher.screensDidLock then
    hs.caffeinate.set("displayIdle", false)
    update_menubar(true)
  end

  if event == hs.caffeinate.watcher.screensDidUnlock then
    hs.caffeinate.set("displayIdle", true)
    update_menubar(true)
  end
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
