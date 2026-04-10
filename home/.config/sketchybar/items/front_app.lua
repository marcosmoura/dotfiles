local sbar = require("sketchybar")
local colors = require("colors")

local front_app = sbar.add("item", "front_app", {
  position = "left",
  padding_left = 3,
  icon = {
    string = "",
    padding_left = 0,
    padding_right = 0,
    background = {
      drawing = true,
      image = { scale = 0.7 },
    },
  },
  label = {
    string = "...",
    padding_left = 8,
    padding_right = 10,
    max_chars = 30,
  },
})

front_app:subscribe("front_app_switched", function(env)
  front_app:set({
    icon = {
      background = {
        image = {
          string = "app." .. env.INFO,
          padding_left = 8
        }
      }
    },
    label = { string = env.INFO },
  })
end)
