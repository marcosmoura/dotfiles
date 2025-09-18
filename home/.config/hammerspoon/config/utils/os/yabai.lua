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
  local yabai = hs.application.get("yabai")

  return yabai and yabai:isRunning()
end

return {
  execute = executeYabai,
  isRunning = isRunning,
}
