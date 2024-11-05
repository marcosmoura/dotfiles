local alert = require("config.utils.alert")
local assets = require("config.utils.assets")
local debounce = require("config.utils.debounce")

local module = {}

local showWifiAlert = function(message, icon)
  alert.custom(message, icon, {}, 2)
end

module.start = function()
  local currentWifi = nil

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

  hs.timer.doAfter(0.5, function()
    currentWifi = hs.wifi.currentNetwork()
    watcher:start()
  end)
end

return module
