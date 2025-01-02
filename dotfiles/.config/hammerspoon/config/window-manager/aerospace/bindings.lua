local caffeine = require("config.caffeine")
local os = require("config.utils.os")
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

--- Lock screen
local onLockScreen = function()
  caffeine.uncaffeinate(false)
  hs.caffeinate.lockScreen()
end

hs.hotkey.bind({ "cmd", "ctrl" }, "L", onLockScreen)
hs.hotkey.bind({ "cmd", "ctrl" }, "Q", onLockScreen)

hs.hotkey.bind({ "cmd", "ctrl" }, "D", function()
  hs.spaces.toggleShowDesktop()
end)

hs.hotkey.bind({ "cmd", "ctrl" }, "X", function()
  hs.window.focusedWindow():close()
end)

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
