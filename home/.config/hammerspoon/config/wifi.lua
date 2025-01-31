local alert = require("config.utils.alert")
local assets = require("config.utils.assets")
local debounce = require("config.utils.debounce")

local module = {}

--- Show a wifi alert
--- @param message string
--- @param icon hs.image
local showWifiAlert = function(message, icon)
  alert.custom(message, icon, {}, 2)
end

module.start = function()
  local currentWifi = nil

  --- Debounced wifi change handler
  local onWifiChange = debounce(function()
    local newWifi = hs.wifi.currentNetwork()

    if newWifi == currentWifi then
      return
    end

    if newWifi then
      showWifiAlert("Connected to " .. newWifi, assets.wifiOn)
    else
      showWifiAlert("Disconnected from " .. currentWifi, assets.wifiOff)
    end

    currentWifi = newWifi
  end, 0.5)

  local watcher = hs.wifi.watcher.new(onWifiChange)

  hs.timer.doAfter(1, function()
    currentWifi = hs.wifi.currentNetwork()
    watcher:start()
  end)
end

return module
