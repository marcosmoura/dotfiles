local alert = require("hs.alert")
local stackline = require("stackline")
local window = require("hs.window")
local application = require("hs.application")
local hotkey = require("hs.hotkey")
local logger = require("hs.logger")
local spaces = require("hs.spaces")

local gapSize = 16
local margin = gapSize / 2
local menubarSize = 24
local log = logger.new("layout", "info")
local module = {}
local appLayout = {}

appLayout["Bitwarden"] = {
	layout = "right",
}
appLayout["Calendar"] = {
	layout = "maximized",
}
appLayout["Code - Insiders"] = {
	layout = "maximized",
}
appLayout["Finder"] = {
	layout = "left",
}
appLayout["Google Chrome Canary"] = {
	layout = "maximized",
}
appLayout["iTerm"] = {
	layout = "maximized",
}
appLayout["Mail"] = {
	layout = "maximized",
}
appLayout["Notion"] = {
	layout = "maximized",
}
appLayout["Spotify"] = {
	layout = "maximized",
}
appLayout["System Preferences"] = {
	layout = "centered",
	ignoreSize = true,
}
appLayout["WhatsApp"] = {
	layout = "centered",
}

function getFocusedWindow()
	return window.focusedWindow()
end

function getScreenFrame()
	return getFocusedWindow():screen():frame()
end

function getWindowFrame()
	return getFocusedWindow():frame()
end

-- +------------------+
-- |         +------+ |
-- |         | HERE | |
-- |         +------+ |
-- |                  |
-- |                  |
-- +------------------+
function module.rightTop(window)
	window = window or getFocusedWindow()

	local frame = getScreenFrame()
	local width = frame.w / 2 - gapSize - margin
	local height = frame.h / 2 - gapSize * 2

	frame.x = width + gapSize + margin * 2
	frame.y = gapSize + menubarSize
	frame.w = width
	frame.h = height

	window:setFrame(frame)
end

-- +------------------+
-- |                  |
-- |                  |
-- |         +------+ |
-- |         | HERE | |
-- |         +------+ |
-- +------------------+
function module.rightDown(window)
	window = window or getFocusedWindow()

	local frame = getScreenFrame()
	local width = frame.w / 2 - gapSize - margin
	local height = frame.h / 2 - gapSize * 2

	frame.x = width + gapSize + margin * 2
	frame.y = frame.h / 2 + gapSize + menubarSize
	frame.w = width
	frame.h = height

	window:setFrame(frame)
end

-- +------------------+
-- | +------+         |
-- | | HERE |         |
-- | +------+         |
-- |                  |
-- |                  |
-- +------------------+
function module.leftTop(window)
	window = window or getFocusedWindow()

	local frame = getScreenFrame()
	local width = frame.w / 2 - gapSize - margin
	local height = frame.h / 2 - gapSize * 2

	frame.x = margin * 2
	frame.y = gapSize + menubarSize
	frame.w = width
	frame.h = height

	window:setFrame(frame)
end

-- +------------------+
-- |                  |
-- |                  |
-- | +------+         |
-- | | HERE |         |
-- | +------+         |
-- +------------------+
function module.leftDown(window)
	window = window or getFocusedWindow()

	local frame = getScreenFrame()
	local width = frame.w / 2 - gapSize - margin
	local height = frame.h / 2 - gapSize * 2

	frame.x = margin * 2
	frame.y = frame.h / 2 + gapSize + menubarSize
	frame.w = width
	frame.h = height

	window:setFrame(frame)
end

-- +------------------+
-- |         +------+ |
-- |         |      | |
-- |         | HERE | |
-- |         |      | |
-- |         +------+ |
-- +------------------+
function module.right(window)
	window = window or getFocusedWindow()

	local frame = getScreenFrame()
	local width = frame.w / 2 - gapSize - margin
	local height = frame.h - gapSize * 2

	frame.x = width + gapSize + margin * 2
	frame.y = gapSize + menubarSize
	frame.w = width
	frame.h = height

	window:setFrame(frame)
end

-- +------------------+
-- | +------+         |
-- | |      |         |
-- | | HERE |         |
-- | |      |         |
-- | +------+         |
-- +------------------+
function module.left(window)
	window = window or getFocusedWindow()

	local frame = getScreenFrame()
	local width = frame.w / 2 - gapSize - margin
	local height = frame.h - gapSize * 2

	frame.x = gapSize
	frame.y = gapSize + menubarSize
	frame.w = width
	frame.h = height

	window:setFrame(frame)
end

-- +------------------+
-- | +--------------+ |
-- | |              | |
-- | |     HERE     | |
-- | |              | |
-- | +--------------+ |
-- +------------------+
function module.maximized(window)
	window = window or getFocusedWindow()

	local frame = getScreenFrame()

	frame.x = gapSize
	frame.y = gapSize + menubarSize
	frame.w = frame.w - gapSize * 2
	frame.h = frame.h - gapSize * 2

	window:setFrame(frame)
end

-- +------------------+
-- |                  |
-- |   +----------+   |
-- |   |   HERE   |   |
-- |   +----------+   |
-- |                  |
-- +------------------+
function module.centered(window, ignoreSize)
	window = window or getFocusedWindow()

	local width = 1440
	local height = 900
	local frame = getWindowFrame()

	if not ignoreSize then
		frame.w = width
		frame.h = height
	end

	window:setFrame(frame)
	window:centerOnScreen(window:screen(), true)

	frame = getWindowFrame()

	frame.y = frame.y - menubarSize / 2
	window:setFrame(frame)
	window:centerOnScreen(window:screen(), true)
end

function setAppLayout(appName, window)
	if not appName then
		appName = getFocusedWindow():application():name()
	end

	local appConfig = appLayout[appName]

	if appConfig then
		local fn = module[appConfig.layout]

		if fn then
			fn(window, appConfig.ignoreSize)
		end
	end
end

function onAppEvent(appName, eventType)
	if eventType == application.watcher.activated then
		setAppLayout(appName)
	end

	if eventType == application.watcher.launched then
		setAppLayout(appName)
	end
end

local appWatcher = application.watcher.new(onAppEvent)
local spacesWatcher = spaces.watcher.new(function()
	setAppLayout()
end)

function applyWindowLayout()
	stackline:init()
	stackline.config:set("appearance.showIcons", false)
	stackline.config:set("appearance.offset.y", 4)
	stackline.config:set("appearance.offset.x", 5)
	stackline.config:set("appearance.fadeDuration", 0.25)
	stackline.config:set("appearance.dimmer", 4)

	appWatcher.stop(appWatcher)
	appWatcher.start(appWatcher)

	spacesWatcher.stop(spacesWatcher)
	spacesWatcher.start(spacesWatcher)

	alert.show("Layout Applied!", 1.5)
end

return function()
	local main = { "cmd", "option" }
	local alt = { "cmd", "alt", "ctrl" }

	hotkey.bind(alt, "L", applyWindowLayout)

	hotkey.bind(main, "up", module.maximized)
	hotkey.bind(main, "down", module.centered)
	hotkey.bind(main, "right", module.right)
	hotkey.bind(main, "left", module.left)

	hotkey.bind(alt, "up", module.leftTop)
	hotkey.bind(alt, "left", module.leftDown)
	hotkey.bind(alt, "right", module.rightTop)
	hotkey.bind(alt, "down", module.rightDown)

	applyWindowLayout()
	setAppLayout()
end
