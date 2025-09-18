local os = require("config.utils.os")
local windows = require("config.utils.windows")

local module = {}
local brewPath = "/opt/homebrew/bin/brew"

--- Check if the borders service is running
--- @return boolean
local hasBordersService = function()
  local bordersService = os.execute(brewPath, "services info borders --json", { json = true })

  return bordersService and bordersService[1] and bordersService[1].running
end

--- Enable the borders service if it's not running
local enableBordersIfNeeded = function()
  if not hasBordersService() then
    os.execute(brewPath, "services start borders", { silent = true })
  end
end

module.start = function()
  local externalBarWidth = 0

  if os.sketchybar.isRunning() then
    externalBarWidth = windows.getMenuBarHeight() or 25
  end

  if not os.yabai.isRunning() then
    os.yabai.execute("--start-service", { silent = true })
  end

  os.yabai.execute("-m config external_bar all:" .. externalBarWidth .. ":0", { silent = true })
  require("config.window-manager.wallpaper").start()
  require("config.window-manager.bindings")
  enableBordersIfNeeded()
end

return module
