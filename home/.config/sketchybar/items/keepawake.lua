local sbar = require("sketchybar")
local colors = require("colors")
local icons = require("icons")
local hover = require("helpers.hover")

local tmp_dir = os.getenv("TMPDIR") or "/tmp"
if not tmp_dir:match("/$") then
  tmp_dir = tmp_dir .. "/"
end

local pid_file = tmp_dir .. "sketchybar_keepawake.pid"
local state_file = tmp_dir .. "sketchybar_keepawake.state"
local STATE_DISABLED = "off"

local function shell_quote(value)
  return "'" .. value:gsub("'", [['"'"']]) .. "'"
end

local pid_file_quoted = shell_quote(pid_file)

local keepawake = sbar.add("item", "keepawake", {
  position = "right",
  icon = {
    string = icons.status.keepawake,
    color = colors.text,
  },
  label = { drawing = false },
  update_freq = 60,
})
hover.item(keepawake)

local function read_pid()
  local file = io.open(pid_file, "r")
  if file == nil then
    return nil
  end

  local pid = tonumber(file:read("*l") or "")
  file:close()

  if pid == nil then
    os.remove(pid_file)
  end

  return pid
end

local function is_enabled()
  local file = io.open(state_file, "r")
  if file == nil then
    return true
  end

  local state = file:read("*l")
  file:close()

  return state ~= STATE_DISABLED
end

local function set_enabled(enabled)
  if enabled then
    os.remove(state_file)
    return
  end

  local file = io.open(state_file, "w")
  if file ~= nil then
    file:write(STATE_DISABLED .. "\n")
    file:close()
  end
end

local function set_active(active)
  sbar.animate("tanh", 15, function()
    keepawake:set({
      icon = {
        color = active and colors.green or colors.overlay1,
        string = icons.status.keepawake,
      },
    })
  end)
end

local function update_state()
  local pid = read_pid()
  if pid == nil then
    set_active(false)
    return
  end

  sbar.exec(string.format("ps -p %d -o comm= 2>/dev/null", pid), function(result)
    local active = type(result) == "string" and result:match("caffeinate") ~= nil
    if not active then
      os.remove(pid_file)
    end

    set_active(active)
  end)
end

local function stop_keepawake(callback)
  sbar.exec(
    string.format("kill $(cat %s 2>/dev/null) 2>/dev/null || true; rm -f %s", pid_file_quoted, pid_file_quoted),
    function()
      if callback then
        callback()
      end
    end)
end

local function has_required_flags(command)
  return type(command) == "string"
      and command:match("caffeinate") ~= nil
      and command:match("%-d") ~= nil
      and command:match("%-i") ~= nil
end

local function start_keepawake(callback)
  sbar.exec(
    string.format("caffeinate -d -i >/dev/null 2>&1 & echo $! > %s", pid_file_quoted),
    function()
      if callback then
        callback()
      end
    end)
end

local function ensure_keepawake()
  if not is_enabled() then
    set_active(false)
    return
  end

  local pid = read_pid()
  if pid == nil then
    start_keepawake(update_state)
    return
  end

  sbar.exec(string.format("ps -p %d -o command= 2>/dev/null", pid), function(result)
    if has_required_flags(result) then
      set_active(true)
      return
    end

    stop_keepawake(function()
      start_keepawake(update_state)
    end)
  end)
end

keepawake:subscribe("routine", ensure_keepawake)
keepawake:subscribe("forced", ensure_keepawake)

keepawake:subscribe("mouse.clicked", function()
  local pid = read_pid()
  if pid ~= nil then
    set_enabled(false)
    stop_keepawake(function()
      update_state()
    end)
    return
  end

  set_enabled(true)
  start_keepawake(function()
    update_state()
  end)
end)

ensure_keepawake()
