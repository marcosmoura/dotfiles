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

local showAlert = function(message, image, style, duration)
  hs.alert.showWithImage(message, image, deepMerge(defaultAlertStyle, style or {}), duration or 1)
end

module.info = function(message, duration)
  showAlert(message, assets.info, nil, duration)
end

module.error = function(message, duration)
  showAlert(message, assets.error, {
    fillColor = { hex = colors.red.hex },
    textColor = { hex = colors.crust.hex },
  }, duration)
end

module.success = function(message, duration)
  showAlert(message, assets.success, {
    fillColor = { hex = colors.green.hex },
    textColor = { hex = colors.crust.hex },
  }, duration)
end

module.warning = function(message, duration)
  showAlert(message, assets.warning, {
    fillColor = { hex = colors.peach.hex },
    textColor = { hex = colors.crust.hex },
  }, duration)
end

module.custom = function(message, iconPath, config, duration)
  showAlert(message, iconPath, config, duration)
end

return module
