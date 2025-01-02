local execute = require("config.utils.os.execute")

local aerospacePath = "/opt/homebrew/bin/aerospace"

--- Run aerospace command
--- @param args ExecuteArgs
--- @param opts table
--- @return ExecuteOutput, boolean
local executeAerospace = function(args, opts)
  return execute(aerospacePath, args, opts)
end

local isRunning = function()
  local aerospace = hs.application.get("aerospace")

  return aerospace and aerospace:isRunning()
end

return {
  execute = executeAerospace,
  isRunning = isRunning,
}
