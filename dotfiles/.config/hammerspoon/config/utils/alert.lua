local colors = require("config.utils.colors")
local tables = require("jls.util.tables")
local alert = hs.alert
local image = hs.image

local module = {}
local assets_path = "~/.config/hammerspoon/assets/"

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

hs.alert.defaultStyle = tables.merge(alert.defaultStyle, default_alert_style)

local show_alert = function(message, icon_path, style, duration)
  local icon = icon_path and image.imageFromPath(assets_path .. icon_path) or nil

  alert.showWithImage(message, icon, tables.merge(default_alert_style, style or {}), duration or 1)
end

module.info = function(message, duration)
  show_alert(message, "info.png", nil, duration)
end

module.error = function(message, duration)
  show_alert(message, "error.png", {
    fillColor = { hex = colors.red.hex },
    textColor = { hex = colors.text.hex },
  }, duration)
end

module.success = function(message, duration)
  show_alert(message, "success.png", {
    fillColor = { hex = colors.green.hex },
    textColor = { hex = colors.text.hex },
  }, duration)
end

module.warning = function(message, duration)
  show_alert(message, "warning.png", {
    fillColor = { hex = colors.orange.hex },
    textColor = { hex = colors.text.hex },
  }, duration)
end

module.custom = function(message, icon_path, config, duration)
  show_alert(message, icon_path, config, duration)
end

return module
