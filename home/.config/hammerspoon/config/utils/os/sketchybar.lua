local execute = require("config.utils.os.execute")

local sketchyBarPath = "/opt/homebrew/bin/sketchybar"

--- Check if SketchyBar is running
--- @return boolean
local isRunning = function()
  local sketchyBar = hs.application.get("SketchyBar")

  return sketchyBar and sketchyBar.isRunning and sketchyBar:isRunning()
end

--- Run SketchyBar command
--- @param args ExecuteArgs
--- @param opts table
--- @return ExecuteOutput, boolean
local executeSketchybar = function(args, opts)
  return execute(sketchyBarPath, args, opts)
end

return {
  isRunning = isRunning,
  execute = executeSketchybar,
}
