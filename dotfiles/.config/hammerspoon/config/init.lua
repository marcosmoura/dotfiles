local module = {}

module.setup = function()
  -- Set default configuration
  require("config.console").start()
  require("config.defaults").start()

  -- Load IPC communication
  require("config.ipc").start()

  -- Load all spoons
  require("config.spoons").start()

  -- Load all modules
  require("config.audio").start()
  require("config.caffeine").start()
  require("config.caps-lock").start()
  require("config.hold-to-quit").start()
  require("config.wallpaper").start()
  require("config.wifi").start()
  require("config.window-manager").start(true)

  local assets = require("config.utils.assets")
  local alert = require("config.utils.alert")

  alert.custom("Configuration Reloaded!", assets.settings, nil, 1)
end

return module
