local caffeine = require("config.caffeine")
local os = require("config.utils.os")
local wallpaper = require("config.window-manager.yabai.wallpaper")
local windows = require("config.utils.windows")

local yabaiDirectionMap = {
  up = "north",
  right = "east",
  down = "south",
  left = "west",
}

--- set the floating window position
--- @param arrowKey string
local setFloatingWindowPosition = function(arrowKey)
  local focusedWindow = hs.window.focusedWindow()

  if not focusedWindow then
    return
  end

  local screen = focusedWindow:screen()
  local screenFrame = windows.getVisibleScreenFrame(screen)

  hs.grid.setGrid("1x1", screen, screenFrame)

  if arrowKey == "down" then
    local width = screenFrame.w
    local height = screenFrame.h
    local ratio = 70 / 100
    local windowWidth = width * ratio
    local windowHeight = height * ratio

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
-- Disable built-in useless hotkeys
--------------------
hs.hotkey.bind({ "cmd" }, "H", noop)
hs.hotkey.bind({ "cmd", "alt" }, "H", noop)

--------------------
-- Misc
--------------------
--- Reload tools
local reloadTools = function()
  os.yabai.execute("--restart-service", { silent = true })
  os.sketchybar.execute("--reload", { silent = true })
  hs.reload()
  wallpaper.removeAll()
end

hs.hotkey.bind({ "cmd", "ctrl" }, "Y", reloadTools)
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
-- Move windows
--------------------
for arrowKey, direction in pairs(yabaiDirectionMap) do
  hs.hotkey.bind({ "cmd", "ctrl" }, arrowKey, function()
    local space = os.yabai.execute("-m query --spaces --space", { json = true })
    local isFloating = space.type == "float"

    if isFloating then
      setFloatingWindowPosition(arrowKey)
      return
    end

    os.yabai.execute({ "-m window --swap", direction }, { silent = true })
  end)
end

--------------------
--- Move windows between displays
--------------------
for arrowKey, direction in pairs(yabaiDirectionMap) do
  hs.hotkey.bind({ "cmd", "alt", "ctrl" }, arrowKey, function()
    os.yabai.execute({ "-m window --display", direction, "--focus" }, { silent = true })
  end)
end

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

--- Cycle windows in the current space
--- @param direction number
local cycleWindows = function(direction)
  local allWindows = windows.getCurrentSpaceWindows()
  local focusedWindow = hs.window.focusedWindow()
  local focusedWindowIndex = hs.fnutils.indexOf(allWindows, focusedWindow)
  local totalWindows = #allWindows

  if totalWindows < 2 or not focusedWindow or not focusedWindowIndex then
    return
  end

  local nextWindowIndex = focusedWindowIndex + direction

  if nextWindowIndex < 1 then
    nextWindowIndex = totalWindows
  elseif nextWindowIndex > totalWindows then
    nextWindowIndex = 1
  end

  allWindows[nextWindowIndex]:focus()
end

hs.hotkey.bind({ "cmd" }, "`", function()
  cycleWindows(-1)
end)

hs.hotkey.bind({ "cmd", "shift" }, "`", function()
  cycleWindows(1)
end)

--------------------
--- Focus monitors
--------------------
for arrowKey, direction in pairs(yabaiDirectionMap) do
  hs.hotkey.bind({ "cmd", "alt", "shift" }, arrowKey, function()
    os.yabai.execute({ "-m display --focus", direction }, { silent = true })
  end)
end

--------------------
--- Resize windows
--------------------
hs.hotkey.bind({ "cmd", "ctrl" }, "=", function()
  os.yabai.execute({
    "-m",
    "window",
    "--resize",
    "right:50:50",
    "--resize",
    "left:-50:-50",
    "--resize",
    "bottom:50:50",
    "--resize",
    "top:-50:-50",
  }, { silent = true })
end)

hs.hotkey.bind({ "cmd", "ctrl" }, "-", function()
  os.yabai.execute({
    "-m",
    "window",
    "--resize",
    "right:-50:-50",
    "--resize",
    "left:50:50",
    "--resize",
    "bottom:-50:-50",
    "--resize",
    "top:50:50",
  }, { silent = true })
end)

hs.hotkey.bind({ "cmd", "ctrl", "alt", "shift" }, "up", function()
  os.yabai.execute("-m window --resize bottom:0:-50", { silent = true })
end)

hs.hotkey.bind({ "cmd", "ctrl", "alt", "shift" }, "down", function()
  os.yabai.execute("-m window --resize bottom:0:50", { silent = true })
end)

hs.hotkey.bind({ "cmd", "ctrl", "alt", "shift" }, "left", function()
  os.yabai.execute("-m window --resize right:-50:0", { silent = true })
end)

hs.hotkey.bind({ "cmd", "ctrl", "alt", "shift" }, "right", function()
  os.yabai.execute("-m window --resize right:50:0", { silent = true })
end)

hs.hotkey.bind({ "cmd", "ctrl" }, "E", function()
  os.yabai.execute("-m space --balance", { silent = true })
end)

--------------------
-- Layouts
--------------------
hs.hotkey.bind({ "cmd", "ctrl" }, "B", function()
  os.yabai.execute("-m space --layout bsp", { silent = true })
end)

hs.hotkey.bind({ "cmd", "ctrl" }, "F", function()
  local space = os.yabai.execute("-m query --spaces --space", { json = true })
  local label = space.label

  if label then
    os.yabai.execute({ "-m config --space", label, "layout float" }, { silent = true })
    return
  end

  os.yabai.execute("-m space --layout float", { silent = true })
end)

hs.hotkey.bind({ "cmd", "ctrl" }, "M", function()
  os.yabai.execute("-m space --layout stack", { silent = true })
end)

for _, key in ipairs({ "V", "C" }) do
  local directionMap = {
    V = "vertical",
    C = "horizontal",
  }

  hs.hotkey.bind({ "cmd", "ctrl" }, key, function()
    local window = os.yabai.execute("-m query --windows --window", { json = true })
    local splitType = window["split-type"]
    local isCurrentLayout = splitType ~= directionMap[key]

    if isCurrentLayout then
      return
    end

    os.yabai.execute("-m window --toggle split", { silent = true })
    os.yabai.execute("-m space --balance", { silent = true })
  end)
end

local module = {}

module.start = function()
  local goToSpace = function(_, space)
    local spaces = os.yabai.execute("-m query --spaces", { json = true })
    local targetSpace = spaces[space]

    hs.spaces.gotoSpace(targetSpace.index)
  end

  hs.ipc.localPort("sketchybar:goToSpace", goToSpace)
end

return module
