local colors = require("config.utils.colors")
local console = require("config.console")
local module = {}

local load_spoons = function()
  hs.loadSpoon("SpoonInstall")

  spoon.SpoonInstall.use_syncinstall = true
  spoon.SpoonInstall:andUse("EmmyLua")
  spoon.SpoonInstall:andUse("RoundedCorners", {
    start = true,
    config = {
      radius = 16,
    },
  })
  spoon.SpoonInstall:andUse("MiddleClickDragScroll", {
    start = true,
    config = {
      indicatorSize = 24,
      indicatorAttributes = {
        type = "circle",
        strokeColor = { alpha = 0 },
        fillColor = { hex = colors.surface2.hex, alpha = 0.5 },
      },
    },
  })
  spoon.SpoonInstall:andUse("ReloadConfiguration", {
    start = true,
  })
  spoon.SpoonInstall:asyncUpdateAllRepos()
end

module.setup = function()
  console.catppuccinDarkMode()
  load_spoons()
  require("config.hold-to-quit")
  require("config.yabai")
  require("config.utils.alert").custom("Configuration Reloaded!", "settings.png")
end

return module
