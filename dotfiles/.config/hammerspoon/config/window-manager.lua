local execute = require("config.utils.execute")
local executeYabai = require("config.utils.executeYabai")
local wallpaper = require("config.wallpaper")

local noop = function() end
local yabai_direction_map = {
  up = "north",
  right = "east",
  down = "south",
  left = "west",
}
local yabai_grid_map = {
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
local reload_tools = function()
  executeYabai("--restart-service")
  hs.reload()
  wallpaper.remove_wallpapers()
end

hs.hotkey.bind({ "cmd", "ctrl" }, "Y", reload_tools)
hs.hotkey.bind({ "cmd", "ctrl" }, "R", reload_tools)

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
for _, arrow_key in ipairs({ "up", "down", "left", "right" }) do
  hs.hotkey.bind({ "cmd", "ctrl" }, arrow_key, function()
    local window = executeYabai("-m query --windows --window", { json = true })
    local is_floating = window["is-floating"]

    if is_floating then
      executeYabai({ "-m window --grid", yabai_grid_map[arrow_key] })
      return
    end

    executeYabai({ "-m window --swap", yabai_direction_map[arrow_key] })
  end)
end

--------------------
--- Move windows between displays
--------------------
for _, arrow_key in ipairs({ "left", "right" }) do
  hs.hotkey.bind({ "cmd", "ctrl", "alt" }, arrow_key, function()
    local hammerspoon_direction_map = {
      left = "moveOneScreenWest",
      right = "moveOneScreenEast",
    }

    hs.window.focusedWindow()[hammerspoon_direction_map[arrow_key]]()
  end)
end

--------------------
--- Focus windows
--------------------
for _, arrow_key in ipairs({ "up", "down", "left", "right" }) do
  hs.hotkey.bind({ "cmd", "ctrl", "shift" }, arrow_key, function()
    local hammerspoon_direction_map = {
      up = "focusWindowNorth",
      right = "focusWindowEast",
      down = "focusWindowSouth",
      left = "focusWindowWest",
    }

    hs.window.focusedWindow()[hammerspoon_direction_map[arrow_key]]()
  end)
end

hs.hotkey.bind({ "cmd" }, "`", function()
  local windows = hs.window.orderedWindows()
  local focused_window = hs.window.focusedWindow()

  if focused_window == nil then
    return
  end

  local focused_window_id = hs.window.focusedWindow():id()
  local focused_window_index = 0

  for index, window in ipairs(windows) do
    if window:id() == focused_window_id then
      focused_window_index = index
      break
    end
  end

  local target_window = windows[focused_window_index - 1] or windows[#windows]
  target_window:focus()
end)

--------------------
--- Focus monitors
--------------------
for _, arrow_key in ipairs({ "left", "right" }) do
  hs.hotkey.bind({ "cmd", "alt", "shift" }, arrow_key, function()
    executeYabai({ "-m display --focus", yabai_direction_map[arrow_key] })
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
  local direction_map = {
    V = "vertical",
    C = "horizontal",
  }

  hs.hotkey.bind({ "cmd", "ctrl" }, key, function()
    local window = executeYabai("-m query --windows --window", { json = true })
    local split_type = window["split-type"]
    local is_current_layout = split_type ~= direction_map[key]

    if is_current_layout then
      return
    end

    executeYabai("-m window --toggle split")
    executeYabai("-m space --balance")
  end)
end

local module = {}

module.start = noop

return module
