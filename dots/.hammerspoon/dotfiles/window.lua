local alert = require("hs.alert")
local hotkey = require("hs.hotkey")
local screen = require("hs.screen")
local stackline = require("stackline")
local window = require("hs.window")

local centered = {
	horizontal = {
		w = 1440,
		h = 900,
	},
	vertical = {
		w = 1280,
		h = 2000,
	},
}
local gapSize = 16
local margin = gapSize / 2
local menubarSize = 24
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

local function getFocusedWindow()
	return window.focusedWindow()
end

local function getScreenFrame()
	return getFocusedWindow():screen():frame()
end

local function getWindowFrame()
	return getFocusedWindow():frame()
end

-- +------------------+
-- |         +------+ |
-- |         | HERE | |
-- |         +------+ |
-- |                  |
-- |                  |
-- +------------------+
function module.rightTop(win)
	win = win or getFocusedWindow()

	local frame = getScreenFrame()
	local width = frame.w / 2 - gapSize - margin
	local height = frame.h / 2 - gapSize * 2

	frame.x = width + gapSize + margin * 2
	frame.y = gapSize + menubarSize
	frame.w = width
	frame.h = height

	win:setFrame(frame)
end

-- +------------------+
-- |                  |
-- |                  |
-- |         +------+ |
-- |         | HERE | |
-- |         +------+ |
-- +------------------+
function module.rightDown(win)
	win = win or getFocusedWindow()

	local frame = getScreenFrame()
	local width = frame.w / 2 - gapSize - margin
	local height = frame.h / 2 - gapSize * 2

	frame.x = width + gapSize + margin * 2
	frame.y = frame.h / 2 + gapSize + menubarSize
	frame.w = width
	frame.h = height

	win:setFrame(frame)
end

-- +------------------+
-- | +------+         |
-- | | HERE |         |
-- | +------+         |
-- |                  |
-- |                  |
-- +------------------+
function module.leftTop(win)
	win = win or getFocusedWindow()

	local frame = getScreenFrame()
	local width = frame.w / 2 - gapSize - margin
	local height = frame.h / 2 - gapSize * 2

	frame.x = margin * 2
	frame.y = gapSize + menubarSize
	frame.w = width
	frame.h = height

	win:setFrame(frame)
end

-- +------------------+
-- |                  |
-- |                  |
-- | +------+         |
-- | | HERE |         |
-- | +------+         |
-- +------------------+
function module.leftDown(win)
	win = win or getFocusedWindow()

	local frame = getScreenFrame()
	local width = frame.w / 2 - gapSize - margin
	local height = frame.h / 2 - gapSize * 2

	frame.x = margin * 2
	frame.y = frame.h / 2 + gapSize + menubarSize
	frame.w = width
	frame.h = height

	win:setFrame(frame)
end

-- +------------------+
-- |         +------+ |
-- |         |      | |
-- |         | HERE | |
-- |         |      | |
-- |         +------+ |
-- +------------------+
function module.right(win)
	win = win or getFocusedWindow()

	local frame = getScreenFrame()
	local width = frame.w / 2 - gapSize - margin
	local height = frame.h - gapSize * 2

	frame.x = width + gapSize + margin * 2
	frame.y = gapSize + menubarSize
	frame.w = width
	frame.h = height

	win:move(frame, win:screen())
end

-- +------------------+
-- | +------+         |
-- | |      |         |
-- | | HERE |         |
-- | |      |         |
-- | +------+         |
-- +------------------+
function module.left(win)
	win = win or getFocusedWindow()

	local frame = getScreenFrame()
	local width = frame.w / 2 - gapSize - margin
	local height = frame.h - gapSize * 2

	frame.x = gapSize
	frame.y = gapSize + menubarSize
	frame.w = width
	frame.h = height

	win:setFrame(frame)
end

-- +------------------+
-- | +--------------+ |
-- | |              | |
-- | |     HERE     | |
-- | |              | |
-- | +--------------+ |
-- +------------------+
function module.maximized(win)
	win = win or getFocusedWindow()

	local frame = getScreenFrame()

	frame.x = gapSize
	frame.y = gapSize + menubarSize
	frame.w = frame.w - gapSize * 2
	frame.h = frame.h - gapSize * 2

	win:setFrame(frame)
end

-- +------------------+
-- |                  |
-- |   +----------+   |
-- |   |   HERE   |   |
-- |   +----------+   |
-- |                  |
-- +------------------+
function module.centered(win, ignoreSize)
	win = win or getFocusedWindow()

	local frame = getWindowFrame()
	local width = centered.horizontal.w
	local height = centered.horizontal.h

	if frame.w <= centered.horizontal.w then
		width = centered.vertical.w
		height = centered.vertical.h
	end

	if not ignoreSize then
		frame.w = width
		frame.h = height
	end

	win:setFrame(frame)
	win:centerOnScreen(win:screen(), true)

	frame = getWindowFrame()

	frame.y = frame.y - menubarSize / 2
	win:setFrame(frame)
	win:centerOnScreen(win:screen(), true)
end

local function moveWindowToDisplay(displayNumber)
	local displays = screen.allScreens()

	return function()
		getFocusedWindow():moveToScreen(displays[displayNumber], false, true)
	end
end

local function setAppLayout(appName, win)
	if not appName then
		appName = getFocusedWindow():application():name()
	end

	local appConfig = appLayout[appName]

	if appConfig then
		local fn = module[appConfig.layout]

		if fn then
			fn(win, appConfig.ignoreSize)
		end
	end
end

local function applyWindowLayout()
	stackline:init()
	stackline.config:set("appearance.showIcons", false)
	stackline.config:set("appearance.offset.y", 4)
	stackline.config:set("appearance.offset.x", 5)
	stackline.config:set("appearance.fadeDuration", 0.25)
	stackline.config:set("appearance.dimmer", 4)

	alert.show("Layout Applied!", 1.5)
end

return function()
	local main = { "cmd", "option" }
	local alt = { "cmd", "option", "shift" }
	local screen = { "ctrl", "option", "cmd" }

	hotkey.bind(alt, "L", applyWindowLayout)

	hotkey.bind(main, "up", module.maximized)
	hotkey.bind(main, "down", module.centered)
	hotkey.bind(main, "right", module.right)
	hotkey.bind(main, "left", module.left)

	hotkey.bind(alt, "up", module.leftTop)
	hotkey.bind(alt, "left", module.leftDown)
	hotkey.bind(alt, "right", module.rightTop)
	hotkey.bind(alt, "down", module.rightDown)

	hotkey.bind(screen, "right", moveWindowToDisplay(1))
	hotkey.bind(screen, "left", moveWindowToDisplay(2))

	applyWindowLayout()
	setAppLayout()
end
