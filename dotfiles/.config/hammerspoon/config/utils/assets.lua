local assetsPath = "~/.config/hammerspoon/assets/"

--- @class IconSize
--- @field w number
--- @field h number

--- Create and cache an icon
--- @param path string
--- @param size IconSize
--- @return hs.image|nil
local prepareIcon = function(path, size)
  local icon = path and hs.image.imageFromPath(assetsPath .. path) or nil

  if icon ~= nil then
    local iconSize = icon:size()
    local iconIsSmaller = iconSize.w < size.w or iconSize.h < size.h
    local iconIsLarger = iconSize.w > size.w or iconSize.h > size.h

    if iconIsSmaller or iconIsLarger then
      icon = icon:setSize(size)
    end
  end

  return icon
end

return {
  mug = prepareIcon("mug.png", { w = 32, h = 32 }),
  mugSmall = prepareIcon("mug.png", { w = 16, h = 16 }),
  mugFilled = prepareIcon("mug-filled.png", { w = 32, h = 32 }),
  mugFilledSmall = prepareIcon("mug-filled.png", { w = 16, h = 16 }),
  info = prepareIcon("info.png", { w = 32, h = 32 }),
  error = prepareIcon("error.png", { w = 32, h = 32 }),
  success = prepareIcon("success.png", { w = 32, h = 32 }),
  warning = prepareIcon("warning.png", { w = 32, h = 32 }),
  wifiOn = prepareIcon("wifi-on.png", { w = 32, h = 32 }),
  wifiOff = prepareIcon("wifi-off.png", { w = 32, h = 32 }),
  settings = prepareIcon("settings.png", { w = 32, h = 32 }),
  notPlaying = prepareIcon("not-playing.png", { w = 24, h = 24 }),
}
