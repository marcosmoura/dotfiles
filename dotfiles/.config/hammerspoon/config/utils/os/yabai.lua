local execute = require("config.utils.os.execute")

local yabaiPath = "/opt/homebrew/bin/yabai"

--- Run yabai command
--- @param args ExecuteArgs
--- @param opts table
--- @return ExecuteOutput, boolean
local executeYabai = function(args, opts)
  return execute(yabaiPath, args, opts)
end

--- Check if yabai is running
--- @return boolean
local isRunning = function()
  local services = os.execute("launchctl list")
  local normalizedServices = type(services) == "table" and table.concat(services, "") or services
  local matchesYabai = string.find(tostring(normalizedServices), "yabai")

  return matchesYabai ~= nil and matchesYabai ~= ""
end

return {
  execute = executeYabai,
  isRunning = isRunning,
}
