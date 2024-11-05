local alert = require("config.utils.alert")
local assets = require("config.utils.assets")

local module = {}

local menubarItem = hs.menubar.new()

local updateMenubar = function(showAlert)
  if menubarItem == nil then
    return
  end

  local state = hs.caffeinate.get("displayIdle")
  local menubarIcon = state and assets.mugFilledSmall or assets.mugSmall
  local message = "Caffeinate is " .. (state and "enabled" or "disabled") .. "!"

  menubarItem:setIcon(menubarIcon)
  menubarItem:setTooltip(message)

  if showAlert then
    local alertIcon = state and assets.mugFilled or assets.mug

    alert.custom(message, alertIcon)
  end
end

local onCaffeinate = function(event)
  if event == hs.caffeinate.watcher.screensDidLock then
    hs.caffeinate.set("displayIdle", false)
    updateMenubar(true)
  end

  if event == hs.caffeinate.watcher.screensDidUnlock then
    hs.caffeinate.set("displayIdle", true)
    updateMenubar(true)
  end
end

module.start = function()
  if menubarItem == nil then
    return
  end

  menubarItem:autosaveName("caffeinate")
  menubarItem:setClickCallback(function()
    hs.caffeinate.toggle("displayIdle")
    updateMenubar(true)
  end)

  hs.caffeinate.watcher.new(onCaffeinate):start()
  hs.caffeinate.set("displayIdle", true)
  updateMenubar(false)
end

return module
