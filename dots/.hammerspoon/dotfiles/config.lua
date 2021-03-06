local alert = require 'hs.alert'
local application = require 'hs.application'
local canvas = require 'hs.canvas'
local console = require 'hs.console'
local hotkey = require 'hs.hotkey'
local window = require 'hs.window'

function initialSetup ()
  console.clearConsole()
  console.darkMode(true)
  application.enableSpotlightForNameSearches(true)
  hs.autoLaunch(true)
  hs.automaticallyCheckForUpdates(true)
  hs.consoleOnTop(true)
  hs.dockIcon(false)
  hs.menuIcon(true)
  hs.preferencesDarkMode(true)
  hs.uploadCrashData(false)
end

function configureAlert ()
  alert.defaultStyle.strokeColor = { white = 0, alpha = 0.54 }
  alert.defaultStyle.fillColor = { white = 0, alpha = 0.54 }
  alert.defaultStyle.textSize = 24
  alert.defaultStyle.radius = 12
  alert.defaultStyle.fadeInDuration = 0.125
  alert.defaultStyle.fadeOutDuration = 0.125
end

function configureRoundedCorners ()
  RoundedCorners = hs.loadSpoon('RoundedCorners')
  RoundedCorners.radius = 8
  RoundedCorners.level = canvas.windowLevels.assistiveTechHigh + 1
  RoundedCorners:start()
end

function configureWindow ()
  window.animationDuration = 0.125
  window.setFrameCorrectness = false
  window.setShadows(true)
end

return function ()
	initialSetup()
	configureAlert()
	configureRoundedCorners()
  configureWindow()
end
