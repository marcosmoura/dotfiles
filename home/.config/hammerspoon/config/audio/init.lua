local devices = require("config.audio.devices")
local music = require("config.audio.music")

local module = {}

module.start = function()
  devices.start()
  music.start()
end

return module
