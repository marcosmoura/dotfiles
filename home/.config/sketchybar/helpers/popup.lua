local sbar = require("sketchybar")
local colors = require("colors")
local settings = require("settings")

local popup = {}

function popup.content_width(width, options)
  options = options or {}
  local icon_width = options.icon_width or settings.icons.width
  local edge_padding = options.edge_padding or 24
  return width - (icon_width + edge_padding)
end

function popup.create_row(name, popup_name, options)
  options = options or {}

  local width = options.width or 180
  local icon_width = options.icon_width or settings.icons.width
  local content_width = options.content_width or popup.content_width(width, {
    icon_width = icon_width,
    edge_padding = options.edge_padding,
  })

  local icon = {
    string = options.icon or "",
    color = options.icon_color or colors.text,
    width = icon_width,
    padding_left = options.icon_padding_left or 8,
    padding_right = options.icon_padding_right or 4,
  }

  if options.icon_font ~= nil then
    icon.font = options.icon_font
  end

  return sbar.add("item", name, {
    position = "popup." .. popup_name,
    width = width,
    padding_left = options.padding_left or 0,
    padding_right = options.padding_right or 0,
    icon = icon,
    label = {
      string = options.label or "",
      color = options.label_color or colors.subtext0,
      font = options.label_font or {
        family = settings.font.text,
        style = "Medium",
        size = settings.popup.font_size or 14.0,
      },
      width = options.label_width or content_width,
      align = options.align or "left",
      padding_left = options.label_padding_left or 4,
      padding_right = options.label_padding_right or 8,
    },
  })
end

function popup.create_text_row(name, popup_name, options)
  options = options or {}

  return sbar.add("item", name, {
    position = "popup." .. popup_name,
    icon = { drawing = false },
    background = options.background or { drawing = false },
    label = {
      string = options.label or "",
      color = options.label_color or colors.subtext0,
      font = options.label_font or {
        family = settings.font.text,
        style = "Medium",
        size = settings.popup.font_size or 14.0,
      },
      width = options.width or 180,
      align = options.align or "left",
      padding_left = options.label_padding_left or 0,
      padding_right = options.label_padding_right or 0,
    },
    padding_left = options.padding_left or 12,
    padding_right = options.padding_right or 12,
  })
end

return popup
