local devices = require("config.audio.devices")

local module = {}

module.start = function()
  devices.start()
end

return module
