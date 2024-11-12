local caffeine = require("config.caffeine")
local executeYabai = require("config.utils.executeYabai")
local wallpaper = require("config.wallpaper")

local noop = function() end
local yabaiDirectionMap = {
  up = "north",
  right = "east",
  down = "south",
  left = "west",
}

local setFloatingWindowPosition = function(arrowKey)
  hs.grid.setGrid("2x1")

  if arrowKey == "down" then
    local width = 2560
    local height = 1440
    local windowWidth = width * 70 / 100
    local windowHeight = height * 70 / 100

    local focusedWindow = hs.window.focusedWindow()
    local frame = focusedWindow:frame()

    focusedWindow:setFrame({
      w = windowWidth,
      h = windowHeight,
      x = frame.x,
      y = frame.y,
    })

    focusedWindow:centerOnScreen()

    return
  end

  if arrowKey == "up" then
    hs.grid.set(hs.window.focusedWindow(), "0,0 2x1")
    return
  end

  if arrowKey == "right" then
    hs.grid.set(hs.window.focusedWindow(), "1,0 1x2")
    return
  end

  if arrowKey == "left" then
    hs.grid.set(hs.window.focusedWindow(), "0,0 1x2")
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
local reloadTools = function()
  executeYabai("--restart-service", { silent = true })
  hs.reload()
  wallpaper.removeWallpapers()
end

hs.hotkey.bind({ "cmd", "ctrl" }, "Y", reloadTools)
hs.hotkey.bind({ "cmd", "ctrl" }, "R", reloadTools)

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

--[[ Clear all notifications ]]
hs.hotkey.bind({ "cmd", "ctrl", "alt" }, "escape", function()
  hs.osascript.applescript([[
    use AppleScript version "2.4"
    use scripting additions
    use framework "Foundation"
    property NSArray : a reference to current application's NSArray
    property closeActionSet : {"Close", "Clear All" }

    on run
      try
        tell application "System Events"
          -- set _elements to UI elements of UI element 1 of scroll area 1 of group 1 of group 1 of window "Notification Center" of application process "NotificationCenter" # just for info at the moment

          set _headings to UI elements of UI element 1 of scroll area 1 of group 1 of group 1 of window "Notification Center" of application process "NotificationCenter" whose role is "AXHeading"
          set _headingscount to count of _headings
        end tell

        repeat _headingscount times
          tell application "System Events" to set _roles to role of UI elements of UI element 1 of scroll area 1 of group 1 of group 1 of window "Notification Center" of application process "NotificationCenter"
          set _headingIndex to its getIndexOfItem:"AXHeading" inList:_roles
          set _closeButtonIndex to _headingIndex + 1
          tell application "System Events" to click item _closeButtonIndex of UI elements of UI element 1 of scroll area 1 of group 1 of group 1 of window "Notification Center" of application process "NotificationCenter"
          delay 0.4
        end repeat

        tell application "System Events"
          set _buttons to buttons of UI element 1 of scroll area 1 of group 1 of group 1 of window "Notification Center" of application process "NotificationCenter"
          repeat with _button in _buttons
            set _actions to actions of _button
            repeat with _action in _actions
              if description of _action is in closeActionSet then
                perform _action
              end if
            end repeat
          end repeat
        end tell
      on error e
        display notification e with title "Error" sound name "Frog"
      end try
    end run

    on getIndexOfItem:anItem inList:aList
      set anArray to NSArray's arrayWithArray:aList
      set ind to ((anArray's indexOfObject:anItem) as number) + 1
      if ind is greater than (count of aList) then
        display dialog "Item '" & anItem & "' not found in list." buttons "OK" default button "OK" with icon 2 with title "Error"
        return 0
      else
        return ind
      end if
    end getIndexOfItem:inList:
  ]])

  hs.osascript.applescript([[
    tell application "System Events" to tell application process "NotificationCenter"
      try
        perform (actions of UI elements of UI element 1 of scroll area 1 of group 1 of group 1 of window "Notification Center" of application process "NotificationCenter" of application "System Events" whose name starts with "Name:Close" or name starts with "Name:Clear All")
      end try
    end tell
  ]])
end)

--------------------
-- Move windows
--------------------
for arrowKey, direction in pairs(yabaiDirectionMap) do
  hs.hotkey.bind({ "cmd", "ctrl" }, arrowKey, function()
    local window = executeYabai("-m query --windows --window", { json = true })
    local space = executeYabai("-m query --spaces --space", { json = true })
    local isFloating = window["is-floating"] or space.type == "float"

    if isFloating then
      setFloatingWindowPosition(arrowKey)
      return
    end

    executeYabai({ "-m window --swap", direction }, { silent = true })
  end)
end

--------------------
--- Move windows between displays
--------------------
for arrowKey, direction in pairs(yabaiDirectionMap) do
  hs.hotkey.bind({ "cmd", "alt", "ctrl" }, arrowKey, function()
    executeYabai({ "-m window --display", direction, "--focus" }, { silent = true })
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

local getFilteredWindows = function()
  local filter = nil

  filter = hs.window.filter
    .new(false)
    :setDefaultFilter({
      visible = true,
      currentSpace = true,
      allowRoles = "AXStandardWindow",
      allowScreens = hs.window.focusedWindow():screen():getUUID(),
      fullscreen = false,
    })
    :rejectApp("Hammerspoon")
    :setSortOrder(hs.window.filter.sortByCreatedLast)
  local windows = filter:getWindows()

  filter:unsubscribeAll()
  filter:pause()
  filter = nil

  return windows
end

local cycleWindows = function(direction)
  local windows = getFilteredWindows()
  local focusedWindow = hs.window.focusedWindow()
  local focusedWindowIndex = hs.fnutils.indexOf(windows, focusedWindow)

  if #windows < 2 or not focusedWindow or not focusedWindowIndex then
    return
  end

  local nextWindowIndex = focusedWindowIndex + direction

  if nextWindowIndex < 1 then
    nextWindowIndex = #windows
  elseif nextWindowIndex > #windows then
    nextWindowIndex = 1
  end

  windows[nextWindowIndex]:focus()
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
    executeYabai({ "-m display --focus", direction }, { silent = true })
  end)
end

--------------------
--- Resize windows
--------------------
hs.hotkey.bind({ "cmd", "ctrl" }, "=", function()
  executeYabai({
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
  executeYabai({
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
  executeYabai("-m window --resize bottom:0:-50", { silent = true })
end)

hs.hotkey.bind({ "cmd", "ctrl", "alt", "shift" }, "down", function()
  executeYabai("-m window --resize bottom:0:50", { silent = true })
end)

hs.hotkey.bind({ "cmd", "ctrl", "alt", "shift" }, "left", function()
  executeYabai("-m window --resize right:-50:0", { silent = true })
end)

hs.hotkey.bind({ "cmd", "ctrl", "alt", "shift" }, "right", function()
  executeYabai("-m window --resize right:50:0", { silent = true })
end)

hs.hotkey.bind({ "cmd", "ctrl" }, "E", function()
  executeYabai("-m space --balance", { silent = true })
end)

--------------------
-- Layouts
--------------------
hs.hotkey.bind({ "cmd", "ctrl" }, "B", function()
  executeYabai("-m space --layout bsp", { silent = true })
end)

hs.hotkey.bind({ "cmd", "ctrl" }, "F", function()
  executeYabai("-m space --layout float", { silent = true })
end)

hs.hotkey.bind({ "cmd", "ctrl" }, "M", function()
  executeYabai("-m space --layout stack", { silent = true })
end)

for _, key in ipairs({ "V", "C" }) do
  local directionMap = {
    V = "vertical",
    C = "horizontal",
  }

  hs.hotkey.bind({ "cmd", "ctrl" }, key, function()
    local window = executeYabai("-m query --windows --window", { json = true })
    local splitType = window["split-type"]
    local isCurrentLayout = splitType ~= directionMap[key]

    if isCurrentLayout then
      return
    end

    executeYabai("-m window --toggle split", { silent = true })
    executeYabai("-m space --balance", { silent = true })
  end)
end

local module = {}

module.start = noop

return module
