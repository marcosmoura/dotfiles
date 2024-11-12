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

module.start = function(withYabai)
  local hasBordersEnabled = hasBordersService()

  --[[ TODO: Unify all window management modules into a single module ]]
  require("config.window-manager.bindings").start()

  if withYabai then
    require("config.window-manager.stack-indicator").start() -- New module
    executeYabai("--start-service", { silent = true })

    if not hasBordersEnabled then
      execute("/opt/homebrew/bin/brew", "services start borders", { silent = true })
    end
  else
    if not hasBordersEnabled then
      require("config.window-manager.experimental.borders").start() -- New module
    end

    require("config.window-manager.experimental.tiling").start() -- New module
    executeYabai("--stop-service", { silent = true })
  end
end

return module
