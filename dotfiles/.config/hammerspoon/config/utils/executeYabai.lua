local execute = require("config.utils.execute")

local yabaiPath = "/opt/homebrew/bin/yabai"

local executeYabai = function(args, opts)
  return execute(yabaiPath, args, opts)
end

return executeYabai
