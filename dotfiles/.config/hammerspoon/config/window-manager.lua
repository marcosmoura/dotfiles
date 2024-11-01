local executeYabai = require("config.utils.executeYabai")
local wallpaper = require("config.wallpaper")

local noop = function() end
local yabaiDirectionMap = {
  up = "north",
  right = "east",
  down = "south",
  left = "west",
}
local yabaiGridMap = {
  up = "1:1:0:0:1:1",
  right = "1:2:1:0:1:1",
  down = "2560:2560:320:320:1920:1920",
  left = "1:2:0:0:1:1",
}

--------------------
-- Disable built-in useless hotkeys
--------------------
hs.hotkey.bind({ "cmd" }, "H", noop)
hs.hotkey.bind({ "cmd", "alt" }, "H", noop)

--------------------
-- Misc
--------------------
local reloadTools = function()
  executeYabai("--restart-service")
  hs.reload()
  wallpaper.removeWallpapers()
end

hs.hotkey.bind({ "cmd", "ctrl" }, "Y", reloadTools)
hs.hotkey.bind({ "cmd", "ctrl" }, "R", reloadTools)

hs.hotkey.bind({ "cmd", "ctrl" }, "L", function()
  hs.caffeinate.lockScreen()
end)

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
for _, arrowKey in ipairs({ "up", "down", "left", "right" }) do
  hs.hotkey.bind({ "cmd", "ctrl" }, arrowKey, function()
    local window = executeYabai("-m query --windows --window", { json = true })
    local isFloating = window["is-floating"]

    if isFloating then
      executeYabai({ "-m window --grid", yabaiGridMap[arrowKey] })
      return
    end

    executeYabai({ "-m window --swap", yabaiDirectionMap[arrowKey] })
  end)
end

--------------------
--- Move windows between displays
--------------------
for _, arrowKey in ipairs({ "left", "right" }) do
  hs.hotkey.bind({ "cmd", "ctrl", "alt" }, arrowKey, function()
    local hammerspoonDirectionMap = {
      left = "moveOneScreenWest",
      right = "moveOneScreenEast",
    }

    hs.window.focusedWindow()[hammerspoonDirectionMap[arrowKey]]()
  end)
end

--------------------
--- Focus windows
--------------------
for _, arrowKey in ipairs({ "up", "down", "left", "right" }) do
  hs.hotkey.bind({ "cmd", "ctrl", "shift" }, arrowKey, function()
    local hammerspoonDirectionMap = {
      up = "focusWindowNorth",
      right = "focusWindowEast",
      down = "focusWindowSouth",
      left = "focusWindowWest",
    }

    hs.window.focusedWindow()[hammerspoonDirectionMap[arrowKey]]()
  end)
end

local cycleWindows = function(direction)
  local windows = hs.window.orderedWindows()
  local focusedWindow = hs.window.focusedWindow()
  local focusedWindowIndex = hs.fnutils.indexOf(windows, focusedWindow)
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
for _, arrowKey in ipairs({ "left", "right" }) do
  hs.hotkey.bind({ "cmd", "alt", "shift" }, arrowKey, function()
    executeYabai({ "-m display --focus", yabaiDirectionMap[arrowKey] })
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
  })
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
  })
end)

hs.hotkey.bind({ "cmd", "ctrl", "alt", "shift" }, "up", function()
  executeYabai("-m window --resize bottom:0:-50")
end)

hs.hotkey.bind({ "cmd", "ctrl", "alt", "shift" }, "down", function()
  executeYabai("-m window --resize bottom:0:50")
end)

hs.hotkey.bind({ "cmd", "ctrl", "alt", "shift" }, "left", function()
  executeYabai("-m window --resize right:-50:0")
end)

hs.hotkey.bind({ "cmd", "ctrl", "alt", "shift" }, "right", function()
  executeYabai("-m window --resize right:50:0")
end)

hs.hotkey.bind({ "cmd", "ctrl" }, "E", function()
  executeYabai("-m space --balance")
end)

--------------------
-- Layouts
--------------------
hs.hotkey.bind({ "cmd", "ctrl" }, "B", function()
  executeYabai("-m space --layout bsp")
end)

hs.hotkey.bind({ "cmd", "ctrl" }, "F", function()
  executeYabai("-m space --layout float")
end)

hs.hotkey.bind({ "cmd", "ctrl" }, "M", function()
  executeYabai("-m space --layout stack")
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

    executeYabai("-m window --toggle split")
    executeYabai("-m space --balance")
  end)
end

local module = {}

module.start = noop

return module
