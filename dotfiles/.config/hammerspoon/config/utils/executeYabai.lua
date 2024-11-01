local execute = require("config.utils.execute")

local yabai_path = "/opt/homebrew/bin/yabai"

local executeYabai = function(args, opts)
  return execute(yabai_path, args, opts)
end

return executeYabai
