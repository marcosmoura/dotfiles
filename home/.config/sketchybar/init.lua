local function dirname(path)
  return path:match("(.+)/[^/]+$") or "."
end

local source = debug.getinfo(1, "S").source
local script_path = source:sub(1, 1) == "@" and source:sub(2) or source
local config_dir = os.getenv("CONFIG_DIR") or dirname(script_path)
local sbar_lua_dir = os.getenv("SBAR_LUA_DIR")
    or (os.getenv("HOME") .. "/.local/share/sketchybar_lua")

package.path = table.concat({
  config_dir .. "/?.lua",
  config_dir .. "/?/init.lua",
  package.path,
}, ";")

package.cpath = table.concat({
  sbar_lua_dir .. "/?.so",
  package.cpath,
}, ";")

local sbar = require("sketchybar")
local colors = require("colors")
local settings = require("settings")

sbar.hotload(true)
sbar.begin_config()

-- Bar appearance (floating rounded pill, matching Stache)
sbar.bar({
  position = "top",
  height = settings.bar.height,
  color = "transparent",
  corner_radius = settings.bar.corner_radius,
  padding_left = settings.bar.padding,
  padding_right = settings.bar.padding,
  sticky = true,
  topmost = "window",
  font_smoothing = true,
  y_offset = settings.bar.y_offset,
  margin = settings.bar.margin,
  notch_width = 0,
})

-- Default item properties (match Stache proportions with Hugeicons icon font)
sbar.default({
  icon = {
    font = {
      family = settings.font.icons,
      style = "Regular",
      size = settings.icons.font_size,
    },
    align = "center",
    color = colors.text,
    padding_left = 10,
    padding_right = 8,
  },
  label = {
    color = colors.text,
    font = { family = settings.font.text, style = "Medium", size = 13.2, features = "tnum" },
    padding_left = 0,
    padding_right = 10
  },
  background = {
    color = colors.crust,
    corner_radius = settings.item.corner_radius,
    height = settings.item.height,
    padding_left = 1,
    padding_right = 1,
    border_width = 0,
  },
  popup = {
    align = "right",
    height = settings.popup.height,
    y_offset = settings.popup.y_offset,
    background = {
      color = colors.crust,
      corner_radius = settings.popup.corner_radius,
      border_color = colors.surface0,
      border_width = 1,
      shadow = { drawing = true },
    },
  },
  padding_left = 2,
  padding_right = 2,
  updates = "when_shown",
})

-- Custom events
sbar.add("event", "aerospace_workspace_change")

-- Load items (LEFT section)
require("items.spaces")
require("items.front_app")

-- Load items (CENTER section)
require("items.media")

-- Load items (RIGHT section)
require("items.clock")
require("items.battery")
require("items.cpu")
require("items.keepawake")
require("items.weather")
require("items.status_aliases")

sbar.end_config()
sbar.event_loop()
