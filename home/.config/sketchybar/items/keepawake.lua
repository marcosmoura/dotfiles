local sbar = require("sketchybar")
local colors = require("colors")
local hover = require("helpers.hover")

local tmp_dir = os.getenv("TMPDIR") or "/tmp"
if not tmp_dir:match("/$") then
  tmp_dir = tmp_dir .. "/"
end

local pid_file = tmp_dir .. "sketchybar_keepawake.pid"

local function shell_quote(value)
  return "'" .. value:gsub("'", [['"'"']]) .. "'"
end

local pid_file_quoted = shell_quote(pid_file)

local keepawake = sbar.add("item", "keepawake", {
  position = "right",
  icon = {
    string = "󰅶",
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

local function set_active(active)
  sbar.animate("tanh", 15, function()
    keepawake:set({
      icon = {
        color = active and colors.green or colors.text,
        string = active and "󰅶" or "󰛊"
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

keepawake:subscribe("routine", update_state)
keepawake:subscribe("forced", update_state)

keepawake:subscribe("mouse.clicked", function()
  local pid = read_pid()
  if pid ~= nil then
    sbar.exec(string.format("kill %d 2>/dev/null || true; rm -f %s", pid, pid_file_quoted), function()
      update_state()
    end)
    return
  end

  -- Use an idle-sleep assertion so long-running work keeps the system awake.
  sbar.exec(string.format("caffeinate -i >/dev/null 2>&1 & echo $! > %s", pid_file_quoted), function()
    update_state()
  end)
end)

update_state()
