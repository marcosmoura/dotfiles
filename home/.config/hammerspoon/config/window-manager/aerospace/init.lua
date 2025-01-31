local module = {}

module.start = function()
  require("config.window-manager.aerospace.bindings").start()
  require("config.window-manager.aerospace.wallpaper").start()
end

return module
