local alert = require 'hs.alert'
local spaces = require 'hs.spaces'
local geometry = require 'hs.geometry'
local layout = require 'hs.layout'
local screen = require 'hs.screen'

local monitor = screen.mainScreen()
local mainScreenSizes = monitor:fullFrame()
local screenWidth = mainScreenSizes.w
local screenHeight = mainScreenSizes.h

function setWindowPosition (windowLayout, app, w, h)
  w = w or 1440
  h = h or 900

  local left = screenWidth / 2 - w / 2
  local top = screenHeight / 2 - h / 2 - 16

  table.insert(windowLayout, {app, nil, monitor, nil, geometry.rect(left, top, w, h), nil})
end

function applyLayout ()
  local windowLayout = {}

  setWindowPosition(windowLayout, 'Bitwarden')
  setWindowPosition(windowLayout, 'Discord')
  setWindowPosition(windowLayout, 'Steam')
  setWindowPosition(windowLayout, 'WhatsApp')

  layout.apply(windowLayout)
end

local spacesWatcher = spaces.watcher.new(applyLayout)

spacesWatcher.stop(spacesWatcher)
spacesWatcher.start(spacesWatcher)

return function ()
  applyLayout()

  alert.show('Layout Applied!', 1.5)
end
