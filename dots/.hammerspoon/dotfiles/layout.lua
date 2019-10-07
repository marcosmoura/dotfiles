local alert = require 'hs.alert'
local geometry = require 'hs.geometry'
local layout = require 'hs.layout'
local monitorName = 'Optix AG32CQ'

function setupTilingWindow (windowLayout, app, x, y, w, h)
  table.insert(windowLayout, {app, nil, monitorName, nil, geometry.rect(x, y, w, h), nil})
end

function setupMaximizedWindows (windowLayout)
  local maximized = {
    'iTerm2',
    'Code - Insiders',
    'WebStorm',
    'Google Chrome',
    'Firefox Nightly',
    'Spotify',
    'Notion',
    'Netflix'
  }

  for i, app in ipairs(maximized) do
    table.insert(windowLayout, { app, nil, monitorName, layout.maximized, nil })
  end
end

function setupManualWindows (windowLayout)
  setupTilingWindow(windowLayout, 'Franz', 560, 257, 1440, 900)
  setupTilingWindow(windowLayout, 'Finder', 16, 38, 1024, 600)
  setupTilingWindow(windowLayout, 'Wake Up Time', 240, 880, 848, 524)
  setupTilingWindow(windowLayout, 'Calendar', 1056, 38, 1488, 1336)
  setupTilingWindow(windowLayout, 'Agenda', 752, 38, 1792, 1330)
end

return function ()
  local windowLayout = {}

  setupMaximizedWindows(windowLayout)
  setupManualWindows(windowLayout)

  layout.apply(windowLayout)
  alert.show('Layout Applied!', 1.5)
end
