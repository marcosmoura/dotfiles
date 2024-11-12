local alert = require("config.utils.alert")
local assets = require("config.utils.assets")

local menubarItem = hs.menubar.new()

local updateMenubar = function(showAlert)
  local hasAlert = showAlert ~= nil and showAlert or true

  if menubarItem == nil then
    return
  end

  local state = hs.caffeinate.get("displayIdle")
  local menubarIcon = state and assets.mugFilledSmall or assets.mugSmall
  local message = "Caffeinate is " .. (state and "enabled" or "disabled") .. "!"

  menubarItem:setIcon(menubarIcon)
  menubarItem:setTooltip(message)

  if hasAlert then
    local alertIcon = state and assets.mugFilled or assets.mug

    alert.custom(message, alertIcon)
  end
end

local caffeinate = function(showAlert)
  hs.caffeinate.set("displayIdle", true)
  updateMenubar(showAlert)
end

local uncaffeinate = function(showAlert)
  hs.caffeinate.set("displayIdle", false)
  updateMenubar(showAlert)
end

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

  hs.ipc.localPort("yabaiHammerSpoon:onSystemWoke", caffeinate)
end

return module
