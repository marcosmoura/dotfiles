local caffeine = require("config.caffeine")
local os = require("config.utils.os")
local wallpaper = require("config.window-manager.aerospace.wallpaper")
local windows = require("config.utils.windows")

local directions = { "up", "down", "left", "right" }

--- Set floating window position
--- @param arrowKey string
local setFloatingWindowPosition = function(arrowKey)
  local focusedWindow = hs.window.focusedWindow()

  if not focusedWindow then
    return
  end

  local screen = focusedWindow:screen()
  local screenFrame = windows.getVisibleScreenFrame(screen)

  screenFrame.w = screenFrame.w - 2

  hs.grid.setGrid("1x1", screen, screenFrame)

  if arrowKey == "down" then
    local width = screenFrame.w
    local height = screenFrame.h
    local windowWidth = width * 70 / 100
    local windowHeight = height * 70 / 100

    focusedWindow
      :setSize({
        w = windowWidth,
        h = windowHeight,
      })
      :centerOnScreen()

    return
  end

  hs.grid.setGrid("2x1", screen, screenFrame)

  if arrowKey == "up" then
    hs.grid.set(focusedWindow, "0,0 2x1")
    return
  end

  if arrowKey == "right" then
    hs.grid.set(focusedWindow, "1,0 1x2")
    return
  end

  if arrowKey == "left" then
    hs.grid.set(focusedWindow, "0,0 1x2")
    return
  end
end

--------------------
-- Move windows
--------------------
for _, arrowKey in ipairs(directions) do
  hs.hotkey.bind({ "cmd", "ctrl" }, arrowKey, function()
    local space = os.aerospace.execute("list-workspaces --focused", { format = "string" })
    local isFloating = space == "communication"

    if isFloating then
      setFloatingWindowPosition(arrowKey)
      return
    end

    os.aerospace.execute({ "move", arrowKey }, { silent = true })
  end)
end

--------------------
-- Misc
--------------------
--- Reload Hammerspoon and tools
local reloadTools = function()
  hs.reload()
  os.aerospace.execute("mode service", { silent = true })
  os.aerospace.execute("reload-config", { silent = true })
  os.aerospace.execute("mode main", { silent = true })
  os.aerospace.execute("balance-sizes", { silent = true })
end

hs.hotkey.bind({ "cmd", "ctrl" }, "R", reloadTools)
hs.hotkey.bind({ "cmd", "ctrl", "shift" }, "W", wallpaper.changeWallpaper)

--- Lock screen
local onLockScreen = function()
  caffeine.uncaffeinate(false)
  hs.caffeinate.lockScreen()
end

hs.hotkey.bind({ "cmd", "ctrl" }, "L", onLockScreen)
hs.hotkey.bind({ "cmd", "ctrl" }, "Q", onLockScreen)

-- Show desktop
hs.hotkey.bind({ "cmd", "ctrl" }, "D", function()
  hs.spaces.toggleShowDesktop()
end)

-- Close window
hs.hotkey.bind({ "cmd", "ctrl" }, "X", function()
  hs.window.focusedWindow():close()
end)

-- Toggle Hammerspoon console
hs.hotkey.bind({ "cmd", "ctrl", "alt" }, "C", function()
  hs.toggleConsole()
end)

--------------------
--- Focus windows
--------------------
local focusDirectionMap = {
  up = "focusWindowNorth",
  right = "focusWindowEast",
  down = "focusWindowSouth",
  left = "focusWindowWest",
}

for arrowKey, direction in pairs(focusDirectionMap) do
  hs.hotkey.bind({ "cmd", "ctrl", "shift" }, arrowKey, function()
    local focusedWindow = hs.window.focusedWindow()

    focusedWindow[direction](focusedWindow)
  end)
end

--- Cycle windows in the workspace
--- @param direction number
local cycleWindows = function(direction)
  local allWindows = os.aerospace.execute("list-windows --workspace focused --json", { format = "json" })
  local focusedWindow = hs.window.frontmostWindow()

  if not focusedWindow then
    return
  end

  allWindowsIds = hs.fnutils.map(allWindows, function(window)
    return window["window-id"]
  end)

  local focusedWindowIndex = hs.fnutils.indexOf(allWindowsIds, focusedWindow:id())
  local totalWindows = #allWindows

  if totalWindows < 2 or not focusedWindowIndex then
    return
  end

  local nextWindowIndex = focusedWindowIndex + direction

  if nextWindowIndex < 1 then
    nextWindowIndex = totalWindows
  elseif nextWindowIndex > totalWindows then
    nextWindowIndex = 1
  end

  hs.window(allWindowsIds[nextWindowIndex]):focus()
end

hs.hotkey.bind({ "cmd" }, "`", function()
  cycleWindows(-1)
end)

hs.hotkey.bind({ "cmd", "shift" }, "`", function()
  cycleWindows(1)
end)

--- Open Ghostty with Zellij
--- @param session string
local openGhosttyWithZellij = function(session)
  local ghosttyInstance = hs.application.find("Ghostty")

  if ghosttyInstance then
    ghosttyInstance:kill9()
  end

  hs.timer.doAfter(0.5, function()
    os.execute("open", {
      "-na",
      "Ghostty",
      "--args",
      "--window-padding-x=0,0",
      "--window-padding-y=0,0",
      '--initial-command="/opt/homebrew/bin/zellij attach ' .. session .. '"',
    }, {
      silent = true,
    })
  end)
end

hs.hotkey.bind({ "cmd", "ctrl" }, "G", function()
  openGhosttyWithZellij("FluentUI")
end)

hs.hotkey.bind({ "cmd", "ctrl", "alt" }, "G", function()
  openGhosttyWithZellij("Dotfiles")
end)

local module = {}

module.start = function()
  local onSpaceChanged = function()
    caffeine.caffeinate(false)
  end

  hs.ipc.localPort("aerospace:sleepOnSpacesChanged", onSpaceChanged)
end

return module
