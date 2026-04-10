package.cpath = package.cpath
    .. ";"
    .. os.getenv("HOME")
    .. "/.local/share/sketchybar_lua/?.so"

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

-- Default item properties (match Stache: 13px Maple Mono NF, 500 weight)
sbar.default({
  icon = {
    font = {
      family = settings.font.icons,
      style = "Bold",
      size = settings.icons.font_size,
    },
    align = "center",
    color = colors.text,
    padding_left = 10,
    padding_right = 8,
  },
  label = {
    color = colors.text,
    font = { family = settings.font.text, style = "Medium", size = 13.0 },
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
-- Order: REVERSED because sketchybar stacks right items right-to-left.
-- Visual order (left→right): Weather, KeepAwake, CPU, Battery, Clock
require("items.clock")
require("items.battery")
require("items.cpu")
require("items.keepawake")
require("items.weather")

sbar.end_config()

sbar.event_loop()
