local module = {}

module.setup = function()
  -- Set default configuration
  require("config.console").start()
  require("config.defaults").start()

  -- Load IPC communication
  -- require("config.ipc").start()

  -- Load all spoons
  require("config.spoons").start()

  -- Load all modules
  require("config.caffeine").start()
  require("config.caps-lock").start()

  -- Load modules that create a watcher
  require("config.hold-to-quit").start()
  require("config.wifi").start()

  -- Load slower modules
  require("config.audio").start()
  require("config.window-manager").start()

  local alert = require("config.utils.alert")
  local assets = require("config.utils.assets")

  alert.custom("Reloading Configuration!", assets.settings, nil, 1)
end

return module
