local alert = require("hs.alert")
local application = require("hs.application")
local console = require("hs.console")
local hotkey = require("hs.hotkey")
local window = require("hs.window")

local function init()
	application.enableSpotlightForNameSearches(true)
	hotkey.setLogLevel("warning")
	hs.autoLaunch(true)
	hs.automaticallyCheckForUpdates(true)
	hs.dockIcon(false)
	hs.menuIcon(true)
	hs.preferencesDarkMode(true)
	hs.uploadCrashData(false)
end

local function configureConsole()
	hs.consoleOnTop(true)
	console.clearConsole()
	console.darkMode(true)
end

local function configureAlert()
	alert.defaultStyle.strokeColor = { white = 0, alpha = 0.54 }
	alert.defaultStyle.fillColor = { white = 0, alpha = 0.54 }
	alert.defaultStyle.textSize = 24
	alert.defaultStyle.radius = 12
	alert.defaultStyle.fadeInDuration = 0.125
	alert.defaultStyle.fadeOutDuration = 0.125
end

local function configureWindow()
	window.animationDuration = 0.125
	window.setFrameCorrectness = false
	window.setShadows(true)
end

return function()
	init()
	configureConsole()
	configureAlert()
	configureWindow()
end
