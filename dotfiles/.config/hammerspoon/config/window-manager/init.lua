local execute = require("config.utils.execute")
local executeYabai = require("config.utils.executeYabai")

local module = {}

local hasBordersService = function()
  local bordersService = execute("/opt/homebrew/bin/brew", "services info borders --json", {
    json = true,
    silent = true,
  })

  return bordersService and bordersService[1] and bordersService[1].running
end

local isYabaiRunning = function()
  local services = execute("launchctl list")
  local normalizedServices = type(services) == "table" and table.concat(services, "") or services
  local matchesYabai = string.find(normalizedServices, "yabai")

  return matchesYabai ~= nil and matchesYabai ~= ""
end

module.start = function(withYabai)
  local hasBordersEnabled = hasBordersService()

  --[[ TODO: Unify all window management modules into a single module ]]
  require("config.window-manager.bindings").start()

  if withYabai then
    if not isYabaiRunning() then
      executeYabai("--start-service", { silent = true })
    end

    if not hasBordersEnabled then
      execute("/opt/homebrew/bin/brew", "services start borders", { silent = true })
    end

    require("config.window-manager.stack-indicator").start() -- New module
  else
    executeYabai("--stop-service", { silent = true })

    if not hasBordersEnabled then
      require("config.window-manager.experimental.borders").start() -- New module
    end

    require("config.window-manager.experimental.tiling").start() -- New module
  end
end

return module
