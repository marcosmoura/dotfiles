local alert = require 'hs.alert'
local spaces = require 'hs.spaces'
local geometry = require 'hs.geometry'
local layout = require 'hs.layout'

local monitorName = 'Optix AG32CQ'

function setWindowPosition (windowLayout, app, x, y, w, h)
  table.insert(windowLayout, {app, nil, monitorName, nil, geometry.rect(x, y, w, h), nil})
end

function applyLayout ()
  local windowLayout = {}

  setWindowPosition(windowLayout, 'Discord', 560, 270, 1440, 900)
  setWindowPosition(windowLayout, 'Steam', 560, 270, 1440, 900)
  setWindowPosition(windowLayout, 'WhatsApp', 560, 270, 1440, 900)

  layout.apply(windowLayout)
end

local spacesWatcher = spaces.watcher.new(applyLayout)

spacesWatcher.stop(spacesWatcher)
spacesWatcher.start(spacesWatcher)

return function ()
  applyLayout()

  alert.show('Layout Applied!', 1.5)
end
