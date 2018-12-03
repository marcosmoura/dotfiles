local alert = require 'hs.alert'
local geometry = require 'hs.geometry'
local layout = require 'hs.layout'
local monitorName = '2343'

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
    'Netflix',
    'Steam'
  }

  for i, app in ipairs(maximized) do
    table.insert(windowLayout, {app, nil, monitorName, layout.maximized, nil})
  end
end

function setupManualWindows (windowLayout)
  setupTilingWindow(windowLayout, 'Franz', 320, 127, 1280, 800)
  setupTilingWindow(windowLayout, 'Finder', 16, 38, 848, 500)
  setupTilingWindow(windowLayout, 'Wake Up Time', 156, 675, 848, 526)
  setupTilingWindow(windowLayout, 'Calendar', 880, 38, 1024, 980)
end

return function ()
  local windowLayout = {}

  setupMaximizedWindows(windowLayout)
  setupManualWindows(windowLayout)

  layout.apply(windowLayout)
  alert.show('Layout Applied!', 1)
end
