local inspect = require("inspect")
local glass = require("glass")

local clock = glass.create_hoverable_item("statusbar.clock", {
  position = "right",
  label = {
    padding_left = 9,
    padding_right = 9,
  },
})

local get_formatted_time = function()
  return os.date("%a %b %d %H:%M:%S")
end

local on_time_changed = function(env)
  local time = env.TIME

  if not time then
    time = get_formatted_time()
  end

  clock:set({
    label = {
      string = time
    }
  })
end

clock:subscribe("os_time_changed", on_time_changed)
on_time_changed({ TIME = get_formatted_time() })
