local alert = require("config.utils.alert")
local assets = require("config.utils.assets")

local module = {}

local debounce = function(fn, timeout)
  local timer = nil

  return function(...)
    local args = { ... }
    if timer then
      timer:stop()
      timer = nil
    end

    timer = hs.timer.doAfter(timeout, function()
      fn(table.unpack(args))
      timer = nil
    end)
  end
end

module.start = function()
  local currentWifi = nil

  local onWifiChange = debounce(function()
    local newWifi = hs.wifi.currentNetwork()

    if newWifi == currentWifi then
      return
    end

    if newWifi then
      alert.custom("Connected to " .. newWifi, assets.wifiOn, {}, 2)
    else
      alert.custom("Disconnected from " .. currentWifi, assets.wifiOff, {}, 2)
    end

    currentWifi = newWifi
  end, 0.5)

  hs.wifi.watcher.new(onWifiChange):start()
  currentWifi = hs.wifi.currentNetwork()
end

return module
