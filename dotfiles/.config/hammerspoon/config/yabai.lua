local task = require("config.utils.task")

local hotkey = hs.hotkey
local utils = hs.fnutils
local reload = hs.reload

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
-- Misc
--------------------
local reload_tools = task.to_async(function(await)
  await(task.run(yabai_path, "--restart-service"))
  await(task.run("/opt/homebrew/bin/node", "~/.config/zsh/modules/yabai/bin/wallpaper-manager clean"))
  reload()
end)

hotkey.bind({ "cmd", "ctrl" }, "Y", reload_tools)
hotkey.bind({ "cmd", "ctrl" }, "R", reload_tools)

hotkey.bind({ "cmd", "ctrl" }, "L", function()
  task.run("/usr/bin/open", "-a /System/Library/CoreServices/ScreenSaverEngine.app")
end)

hotkey.bind({ "cmd", "ctrl" }, "D", function()
  task.run(yabai_path, "-m space --toggle show-desktop")
end)

hotkey.bind({ "cmd", "ctrl" }, "X", function()
  task.run(yabai_path, "-m window --close")
end)

--------------------
-- Disable built-in shortcuts
--------------------
hotkey.bind({ "cmd" }, "H", function() end)
-- hotkey.bind({ "cmd" }, "Q", function() end)
hotkey.bind({ "cmd", "alt" }, "H", function() end)

--------------------
-- Move windows
--------------------
for _, arrow_key in ipairs({ "up", "down", "left", "right" }) do
  hotkey.bind({ "cmd", "ctrl" }, arrow_key, function()
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
hotkey.bind(
  { "cmd", "ctrl", "alt" },
  "left",
  task.to_async(function(await)
    await(task.run(yabai_path, "-m window --display next"))
    await(task.run(yabai_path, "-m window --focus next"))
  end)
)

hotkey.bind(
  { "cmd", "ctrl", "alt" },
  "right",
  task.to_async(function(await)
    await(task.run(yabai_path, "-m window --display prev"))
    await(task.run(yabai_path, "-m window --focus prev"))
  end)
)

--------------------
--- Focus windows
--------------------
for _, arrow_key in ipairs({ "up", "down", "left", "right" }) do
  hotkey.bind({ "cmd", "ctrl", "shift" }, arrow_key, function()
    task.run(yabai_path, "-m window --focus " .. yabai_direction_map[arrow_key])
  end)
end

hotkey.bind({ "cmd" }, "`", function()
  local focus_tiling_window = task.to_async(function(await)
    local _, error = await(task.run(yabai_path, "-m window --focus stack.next"))

    if error ~= "" then
      _, error = await(task.run(yabai_path, "-m window --focus stack.first"))
    end

    if error ~= "" then
      _, error = await(task.run(yabai_path, "-m window --focus next"))
    end

    if error ~= "" then
      await(task.run(yabai_path, "-m window --focus first"))
    end
  end)

  local focus_floating_window = function(focused_window)
    return task.async(function(await)
      local space_windows = await(task.run(yabai_path, "-m query --windows --space", { type = "json" }))
      local focused_index = 0

      table.sort(space_windows, function(a, b)
        return a["id"] > b["id"]
      end)

      space_windows = utils.filter(space_windows, function(window)
        return window["role"] == "AXWindow" and window["subrole"] == "AXStandardWindow"
      end) or {}

      utils.some(space_windows, function(window, index)
        if window["id"] == focused_window["id"] then
          focused_index = index
          return true
        end
      end)

      local target_index = focused_index - 1

      if space_windows[target_index] == nil then
        target_index = #space_windows
      end

      task.run(yabai_path, "-m window --focus " .. space_windows[target_index]["id"])
    end)
  end

  task.async(function(await)
    local focused_window = await(task.run(yabai_path, "-m query --windows --window", { type = "json" }))

    if focused_window["is-floating"] == true then
      focus_floating_window(focused_window)
      return
    end

    focus_tiling_window()
  end)
end)

--------------------
--- Focus monitors
--------------------
for _, arrow_key in ipairs({ "left", "right" }) do
  hotkey.bind({ "cmd", "alt", "shift" }, arrow_key, function()
    task.run(yabai_path, "-m display --focus " .. yabai_direction_map[arrow_key])
  end)
end

--------------------
--- Resize windows
--------------------
hotkey.bind({ "cmd", "ctrl" }, "=", function()
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

hotkey.bind({ "cmd", "ctrl" }, "-", function()
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

hotkey.bind({ "cmd", "ctrl", "alt", "shift" }, "up", function()
  task.run(yabai_path, "-m window --resize bottom:0:-50")
end)

hotkey.bind({ "cmd", "ctrl", "alt", "shift" }, "down", function()
  task.run(yabai_path, "-m window --resize bottom:0:50")
end)

hotkey.bind({ "cmd", "ctrl", "alt", "shift" }, "left", function()
  task.run(yabai_path, "-m window --resize right:-50:0")
end)

hotkey.bind({ "cmd", "ctrl", "alt", "shift" }, "right", function()
  task.run(yabai_path, "-m window --resize right:50:0")
end)

hotkey.bind({ "cmd", "ctrl" }, "E", function()
  task.run(yabai_path, "-m space --balance")
end)

--------------------
-- Layouts
--------------------
hotkey.bind({ "cmd", "ctrl" }, "B", function()
  task.run(yabai_path, "-m space --layout bsp")
end)

hotkey.bind({ "cmd", "ctrl" }, "F", function()
  task.run(yabai_path, "-m space --layout float")
end)

hotkey.bind({ "cmd", "ctrl" }, "M", function()
  task.run(yabai_path, "-m space --layout stack")
end)

for _, key in ipairs({ "V", "C" }) do
  local direction_map = {
    V = "vertical",
    C = "horizontal",
  }

  hotkey.bind(
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
