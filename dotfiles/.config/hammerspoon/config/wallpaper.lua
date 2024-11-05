local execute = require("config.utils.execute")
local wallpaperPrefixPath = "/tmp/hammerspoon-wallpapers/"

local wallpaperNameMap = {}

local function getCornerData(rawFrame, radius, menubarHeight)
  local frame = {
    x = rawFrame.x,
    y = rawFrame.y,
    w = rawFrame.w,
    h = rawFrame.h,
  }

  local cornerData = {
    { frame = { x = frame.x, y = 0 }, center = { x = radius, y = radius } },
    {
      frame = { x = frame.x + frame.w - radius, y = 0 },
      center = { x = frame.x + frame.w - radius, y = radius },
    },
    {
      frame = { x = frame.x, y = frame.y + frame.h - radius },
      center = { x = radius, y = frame.y + frame.h - radius },
    },
    {
      frame = { x = frame.x + frame.w - radius, y = frame.y + frame.h - radius },
      center = { x = frame.x + frame.w - radius, y = frame.y + frame.h - radius },
    },
  }

  if menubarHeight ~= 0 then
    cornerData[#cornerData + 1] =
      { frame = { x = frame.x, y = menubarHeight }, center = { x = radius, y = radius + menubarHeight } }
    cornerData[#cornerData + 1] = {
      frame = { x = frame.x + frame.w - radius, y = menubarHeight },
      center = { x = frame.x + frame.w - radius, y = radius + menubarHeight },
    }
    cornerData[#cornerData + 1] = {
      frame = { x = frame.x, y = frame.y + frame.h - radius },
      center = { x = radius, y = frame.y + frame.h - radius },
    }
    cornerData[#cornerData + 1] = {
      frame = { x = frame.x + frame.w - radius, y = frame.y + frame.h - radius },
      center = { x = frame.x + frame.w - radius, y = frame.y + frame.h - radius },
    }
  end

  return cornerData
end

local function getElements(image, frame, cornerData, radius, menubarHeight)
  local elements = {}

  elements[#elements + 1] = {
    type = "image",
    image = image,
    frame = {
      x = 0,
      y = 0,
      w = frame.w,
      h = frame.h,
    },
  }

  for _, data in pairs(cornerData) do
    elements[#elements + 1] = { action = "build", type = "rectangle" }
    elements[#elements + 1] = {
      action = "clip",
      type = "circle",
      center = data.center,
      radius = radius,
      reversePath = true,
    }
    elements[#elements + 1] = {
      action = "fill",
      type = "rectangle",
      frame = { x = data.frame.x, y = data.frame.y, w = radius, h = radius },
      fillColor = {
        alpha = 1,
      },
    }
    elements[#elements + 1] = { type = "resetClip" }
  end

  if menubarHeight ~= 0 then
    elements[#elements + 1] = {
      action = "fill",
      type = "rectangle",
      frame = { x = 0, y = 0, w = frame.w, h = menubarHeight },
      fillColor = {
        hex = "#000000",
      },
    }
  end

  return elements
end

local ensureWallpaperDir = function()
  if hs.fs.attributes(wallpaperPrefixPath) == nil then
    execute("mkdir -p " .. wallpaperPrefixPath)
  end
end

local getWallpaper = function(currentSpace, screen)
  local wallpaperPath = "~/.config/wallpapers/" .. currentSpace .. ".jpg"

  if hs.fs.attributes(wallpaperPath) == nil then
    return
  end

  local image = hs.image.imageFromPath(wallpaperPath)

  if image == nil then
    return
  end

  image = image:setSize({ w = screen:fullFrame().w, h = screen:fullFrame().h }, true)

  return image
end

local createWallpaperWithCorners = function(image, screen)
  local screenFrame = screen:fullFrame()
  local menubarHeight = screen:frame().y
  local radius = 16

  local cornerData = getCornerData(screenFrame, radius, menubarHeight)
  local elements = getElements(image, screenFrame, cornerData, radius, menubarHeight)

  local wallpaperWithCorners = hs.canvas.new({
    x = screenFrame.x,
    y = screenFrame.y,
    w = screenFrame.w,
    h = screenFrame.h,
  })

  if wallpaperWithCorners == nil then
    return
  end

  wallpaperWithCorners
    :appendElements(elements)
    :behavior(hs.canvas.windowBehaviors.canJoinAllSpaces)
    :level(hs.canvas.windowLevels.desktopIcon)

  return wallpaperWithCorners:imageFromCanvas()
end

local getSpaceIndex = function(screen, spaceId)
  local allSpaces = hs.spaces.allSpaces()
  local screenUuid = screen:getUUID()

  if allSpaces == nil or allSpaces[screenUuid] == nil then
    return 0
  end

  for index, space in ipairs(allSpaces[screenUuid]) do
    if space == spaceId then
      return index
    end
  end

  return 0
end

local applyWallpaper = function(path)
  hs.osascript.applescript('tell application "Finder" to set desktop picture to POSIX file "' .. path .. '"')
end

local generateWallpaperForSpace = function()
  local focusedWindow = hs.window.focusedWindow()

  if focusedWindow == nil then
    return
  end

  local screen = focusedWindow:screen()
  local currentSpace = getSpaceIndex(screen, hs.spaces.activeSpaceOnScreen(screen))
  local wallpaperPath = wallpaperPrefixPath .. wallpaperNameMap[currentSpace] .. ".jpg"

  ensureWallpaperDir()

  if hs.fs.attributes(wallpaperPath) then
    applyWallpaper(wallpaperPath)
    return
  end

  local rawWallpaper = getWallpaper(currentSpace, screen)

  if rawWallpaper == nil then
    return
  end

  local wallpaperWithCorners = createWallpaperWithCorners(rawWallpaper, screen)

  if wallpaperWithCorners == nil then
    return
  end

  wallpaperWithCorners:saveToFile(wallpaperPath)
  applyWallpaper(wallpaperPath)
end

local removeWallpapers = function()
  execute("rm -rf " .. wallpaperPrefixPath)
end

local generateWallpaperUuids = function()
  local spaces = hs.spaces.allSpaces()

  if spaces == nil then
    return
  end

  for index, _ in ipairs(spaces[hs.window.focusedWindow():screen():getUUID()]) do
    wallpaperNameMap[index] = hs.host.uuid()
  end
end

local module = {}

module.removeWallpapers = removeWallpapers

module.start = function()
  removeWallpapers()
  generateWallpaperUuids()
  hs.spaces.watcher.new(generateWallpaperForSpace):start()
  hs.screen.watcher
    .new(function()
      removeWallpapers()
      generateWallpaperForSpace()
    end)
    :start()
end

return module
