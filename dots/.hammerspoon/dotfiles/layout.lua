local alert = require 'hs.alert'
local spaces = require 'hs.spaces'
local geometry = require 'hs.geometry'
local layout = require 'hs.layout'

local monitorName = 'Optix AG32CQ'

function setupTilingWindow (windowLayout, app, x, y, w, h)
  table.insert(windowLayout, {app, nil, monitorName, nil, geometry.rect(x, y, w, h), nil})
end

function setupMaximizedWindows (windowLayout)
  local maximized = {
    'Firefox Nightly',
    'Google Chrome'
  }

  for i, app in ipairs(maximized) do
    table.insert(windowLayout, { app, nil, monitorName, layout.maximized, nil })
  end
end

function setupManualWindows (windowLayout)
  setupTilingWindow(windowLayout, 'WhatsApp', 560, 270, 1440, 900)
  setupTilingWindow(windowLayout, 'Discord', 560, 270, 1440, 900)
  setupTilingWindow(windowLayout, 'Steam', 560, 270, 1440, 900)
end

function applyLayout ()
  local windowLayout = {}

  setupMaximizedWindows(windowLayout)
  setupManualWindows(windowLayout)

  layout.apply(windowLayout)
end

local spacesWatcher = spaces.watcher.new(applyLayout)

spacesWatcher.stop(spacesWatcher)
spacesWatcher.start(spacesWatcher)

return function ()
  applyLayout()

  alert.show('Layout Applied!', 1.5)
end
