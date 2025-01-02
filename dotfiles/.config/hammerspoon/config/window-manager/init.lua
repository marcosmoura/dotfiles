local os = require("config.utils.os")

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
  if os.aerospace.isRunning() then
    require("config.window-manager.aerospace").start()
    enableBordersIfNeeded()
  else
    require("config.window-manager.yabai").start()
    enableBordersIfNeeded()
  end

  -- require("config.window-manager.stack-indicator").start()
end

return module
