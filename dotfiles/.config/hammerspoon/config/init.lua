local module = {}

module.setup = function()
  -- Set default configuration
  require("config.console").start()
  require("config.defaults").start()

  -- Load all spoons
  require("config.spoons").start()

  -- Load all modules
  require("config.audio").start()
  require("config.caffeinate").start()
  require("config.caps-lock").start()
  require("config.hold-to-quit").start()
  require("config.wallpaper").start()
  require("config.wifi").start()

  local assets = require("config.utils.assets")
  local alert = require("config.utils.alert")
  local executeYabai = require("config.utils.executeYabai")
  local yabaiEnabled = false

  --[[ TODO: Unify all window management modules into a single module ]]
  require("config.window-manager").start()

  if yabaiEnabled then
    require("config.window-stack-indicator").start()
    executeYabai("--start-service", { silent = true })
  else
    require("config.window-borders").start() -- New module
    require("config.window-tiling").start() -- New module
    executeYabai("--stop-service", { silent = true })
  end

  alert.custom("Configuration Reloaded!", assets.settings, nil, 1)
end

return module
