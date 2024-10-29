local assets = require("config.utils.assets")
local colors = require("config.utils.colors")
local deepMerge = require("config.utils.deepMerge")

local module = {}

local default_alert_style = {
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

hs.alert.defaultStyle = deepMerge(hs.alert.defaultStyle, default_alert_style)

local show_alert = function(message, image, style, duration)
  hs.alert.showWithImage(message, image, deepMerge(default_alert_style, style or {}), duration or 1)
end

module.info = function(message, duration)
  show_alert(message, assets.info, nil, duration)
end

module.error = function(message, duration)
  show_alert(message, assets.error, {
    fillColor = { hex = colors.red.hex },
    textColor = { hex = colors.crust.hex },
  }, duration)
end

module.success = function(message, duration)
  show_alert(message, assets.success, {
    fillColor = { hex = colors.green.hex },
    textColor = { hex = colors.crust.hex },
  }, duration)
end

module.warning = function(message, duration)
  show_alert(message, assets.warning, {
    fillColor = { hex = colors.peach.hex },
    textColor = { hex = colors.crust.hex },
  }, duration)
end

module.custom = function(message, icon_path, config, duration)
  show_alert(message, icon_path, config, duration)
end

return module
