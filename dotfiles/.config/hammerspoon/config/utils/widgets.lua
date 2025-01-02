local deepMerge = require("config.utils.deepMerge")
local memoize = require("config.utils.memoize")
local module = {}

--- Create a new canvas widget
--- @param frame hs.geometry
--- @param callback function
--- @return hs.canvas
local create = function(frame, callback)
  local canvas = hs.canvas.new(frame)

  if not canvas then
    return {}
  end

  canvas:level(hs.canvas.windowLevels.dock)
  canvas:behavior({
    hs.canvas.windowBehaviors.canJoinAllSpaces,
    hs.canvas.windowBehaviors.stationary,
  })
  canvas:mouseCallback(callback)

  return canvas
end

--- Get a text style
--- @param style table
--- @return table
local getTextStyle = memoize(function(style)
  local fontSize = 14

  return deepMerge({
    font = {
      name = "SF Pro Text",
      size = fontSize,
    },
    color = { hex = "#fff" },
    shadow = {
      offset = { h = -1, w = 0 },
      color = { hex = "#000", alpha = 0.4 },
      blurRadius = 2,
    },
    lineBreak = "truncateTail",
    allowsTighteningForTruncation = true,
  }, style)
end)

module.create = create
module.getTextStyle = getTextStyle

return module
