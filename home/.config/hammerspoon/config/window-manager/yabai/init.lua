local os = require("config.utils.os")

local module = {}

module.start = function()
  local externalBarWidth = os.sketchybar.isRunning() and 25 or 0

  if not os.yabai.isRunning() then
    os.yabai.execute("--start-service", { silent = true })
  end

  os.yabai("-m config external_bar all:" .. externalBarWidth .. ":0", { silent = true })
  require("config.window-manager.yabai.bindings")
end

return module
