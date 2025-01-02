local assets = require("config.utils.assets")
local colors = require("config.utils.colors")
local deepMerge = require("config.utils.deepMerge")

local module = {}

local defaultAlertStyle = {
  fadeInDuration = 0.2,
  fadeOutDuration = 0.2,

  fillColor = { hex = colors.crust.hex },
  strokeColor = { alpha = 0 },
  strokeWidth = 0,
  radius = 16,
  padding = 20,

  textFont = "Maple Mono",
  textSize = 24,
  textColor = { hex = colors.text.hex },
}

hs.alert.defaultStyle = deepMerge(hs.alert.defaultStyle, defaultAlertStyle)

--- Show an alert with a message and an image
--- @param message string
--- @param image hs.image|nil
--- @param style table|nil
--- @param duration number|nil
local showAlert = function(message, image, style, duration)
  return hs.alert.showWithImage(message, image, deepMerge(defaultAlertStyle, style or {}), duration or 1)
end

--- Show an info alert with a message
--- @param message string
--- @param duration number
--- @return hs.alert|nil
module.info = function(message, duration)
  return showAlert(message, assets.info, nil, duration)
end

--- Show an error alert with a message
--- @param message string
--- @param duration number
--- @return hs.alert|nil
module.error = function(message, duration)
  return showAlert(message, assets.error, {
    fillColor = { hex = colors.red.hex },
    textColor = { hex = colors.crust.hex },
  }, duration)
end

--- Show a success alert with a message
--- @param message string
--- @param duration number
--- @return hs.alert|nil
module.success = function(message, duration)
  return showAlert(message, assets.success, {
    fillColor = { hex = colors.green.hex },
    textColor = { hex = colors.crust.hex },
  }, duration)
end

--- Show a warning alert with a message
--- @param message string
--- @param duration number
--- @return hs.alert|nil
module.warning = function(message, duration)
  return showAlert(message, assets.warning, {
    fillColor = { hex = colors.peach.hex },
    textColor = { hex = colors.crust.hex },
  }, duration)
end

--- Show a custom alert with a message, an icon path, a config and a duration
--- @param message string
--- @param image hs.image|nil
--- @param config table|nil
--- @param duration number|nil
module.custom = function(message, image, config, duration)
  return showAlert(message, image, config, duration)
end

return module
