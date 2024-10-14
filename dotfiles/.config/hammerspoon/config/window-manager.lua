local hide_notch = require("config.hide-notch")
local task = require("config.utils.task")

local noop = function() end
local yabai_path = "/opt/homebrew/bin/yabai"
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
local reload_tools = task.to_async(function(await)
  await(task.run(yabai_path, "--restart-service"))
  await(task.run("/opt/homebrew/bin/node", "~/.config/zsh/modules/yabai/bin/wallpaper-manager clean"))
  hide_notch.remove_wallpapers()
  hs.reload()
end)

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

hs.hotkey.bind({ "cmd", "ctrl", "options" }, "C", function()
  hs.toggleConsole()
end)

--------------------
-- Move windows
--------------------
for _, arrow_key in ipairs({ "up", "down", "left", "right" }) do
  hs.hotkey.bind({ "cmd", "ctrl" }, arrow_key, function()
    task.async(function(await)
      local window = await(task.run(yabai_path, "-m query --windows --window", { type = "json" }))
      local is_floating = window["is-floating"]

      if is_floating then
        task.run(yabai_path, "-m window --grid " .. yabai_grid_map[arrow_key])
        return
      end

      task.run(yabai_path, "-m window --swap " .. yabai_direction_map[arrow_key])
    end)
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
  local windows = hs.window.visibleWindows()
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
    task.run(yabai_path, "-m display --focus " .. yabai_direction_map[arrow_key])
  end)
end

--------------------
--- Resize windows
--------------------
hs.hotkey.bind({ "cmd", "ctrl" }, "=", function()
  task.run(yabai_path, {
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
  task.run(yabai_path, {
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
  task.run(yabai_path, "-m window --resize bottom:0:-50")
end)

hs.hotkey.bind({ "cmd", "ctrl", "alt", "shift" }, "down", function()
  task.run(yabai_path, "-m window --resize bottom:0:50")
end)

hs.hotkey.bind({ "cmd", "ctrl", "alt", "shift" }, "left", function()
  task.run(yabai_path, "-m window --resize right:-50:0")
end)

hs.hotkey.bind({ "cmd", "ctrl", "alt", "shift" }, "right", function()
  task.run(yabai_path, "-m window --resize right:50:0")
end)

hs.hotkey.bind({ "cmd", "ctrl" }, "E", function()
  task.run(yabai_path, "-m space --balance")
end)

--------------------
-- Layouts
--------------------
hs.hotkey.bind({ "cmd", "ctrl" }, "B", function()
  task.run(yabai_path, "-m space --layout bsp")
end)

hs.hotkey.bind({ "cmd", "ctrl" }, "F", function()
  task.run(yabai_path, "-m space --layout float")
end)

hs.hotkey.bind({ "cmd", "ctrl" }, "M", function()
  task.run(yabai_path, "-m space --layout stack")
end)

for _, key in ipairs({ "V", "C" }) do
  local direction_map = {
    V = "vertical",
    C = "horizontal",
  }

  hs.hotkey.bind(
    { "cmd", "ctrl" },
    key,
    task.to_async(function(await)
      local window = await(task.run(yabai_path, "-m query --windows --window", { type = "json" }))
      local split_type = window["split-type"]
      local is_current_layout = split_type ~= direction_map[key]

      if is_current_layout then
        return
      end

      task.run(yabai_path, "-m window --toggle split")
      task.run(yabai_path, "-m space --balance")
    end)
  )
end

local module = {}

module.start = noop

return module
