local alert = require("config.utils.alert")
local assets = require("config.utils.assets")

local menubarItem = hs.menubar.new()

--- Update the menubar icon and tooltip
--- @param showAlert boolean
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

--- Enable caffeinate
--- @param showAlert boolean
local caffeinate = function(showAlert)
  hs.caffeinate.set("displayIdle", true)
  updateMenubar(showAlert)
end

--- Disable caffeinate
--- @param showAlert boolean
local uncaffeinate = function(showAlert)
  hs.caffeinate.set("displayIdle", false)
  updateMenubar(showAlert)
end

--- Handle caffeinate events
--- @param event string
local onCaffeinate = function(event)
  if event == hs.caffeinate.watcher.screensDidLock then
    uncaffeinate(true)
  end

  if event == hs.caffeinate.watcher.screensDidUnlock then
    caffeinate(true)
  end
end

local module = {}

module.caffeinate = caffeinate
module.uncaffeinate = uncaffeinate

module.start = function()
  if menubarItem == nil then
    return
  end

  menubarItem:autosaveName("caffeinate")
  menubarItem:setClickCallback(function()
    hs.caffeinate.toggle("displayIdle")
    updateMenubar(true)
  end)

  caffeinate(false)
  hs.caffeinate.watcher.new(onCaffeinate):start()
end

return module
