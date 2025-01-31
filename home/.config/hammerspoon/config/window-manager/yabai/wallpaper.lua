local memoize = require("config.utils.memoize")
local os = require("config.utils.os")
local windows = require("config.utils.windows")

local wallpaperPrefixPath = "/tmp/hammerspoon-temp/wallpapers/"
local radius = 12
local wallpaperNameMap = {}

--- Gets the corner data for the given frame and menubar height.
--- @param rawFrame hs.geometry The frame to get the corner data for.
--- @param menubarHeight number The height of the menubar.
--- @return table[] The corner data.
local function getCornerData(rawFrame, menubarHeight)
  local frame = {
    x = 0,
    y = 0,
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

--- Gets the elements for the given image, frame, corner data, and menubar height.
--- @param image hs.image The image to get the elements for.
--- @param frame hs.geometry The frame to get the elements for.
--- @param cornerData table[] The corner data to get the elements
--- @param menubarHeight number The height of the menubar.
--- @return table[] - The elements.
local function getElements(image, frame, cornerData, menubarHeight)
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
        hex = "#000",
      },
    }
  end

  return elements
end

--- Ensures the wallpaper directory exists
local ensureWallpaperDir = function()
  if hs.fs.attributes(wallpaperPrefixPath) == nil then
    os.execute("mkdir", "-p " .. wallpaperPrefixPath)
  end
end

--- Gets the local wallpaper path for the given space.
--- @param currentSpace number - The current space.
--- @return string - The local wallpaper path.
local getLocalWallpaperPath = function(currentSpace)
  return "~/.config/wallpapers/" .. currentSpace .. ".jpg"
end

--- Gets the wallpaper for the given space and screen.
--- @param currentSpace number - The current space.
--- @param screen hs.screen - The screen to get the wallpaper for.
--- @return hs.image|nil - The wallpaper.
local getWallpaper = memoize(function(currentSpace, screen)
  local wallpaperPath = getLocalWallpaperPath(currentSpace)

  if hs.fs.attributes(wallpaperPath) == nil then
    return
  end

  local image = hs.image.imageFromPath(wallpaperPath)

  if image == nil then
    return
  end

  local frame = screen:fullFrame()

  image = image:setSize({ w = frame.w, h = frame.h }, true)

  return image
end)

--- Creates a wallpaper with corners for the given image and screen.
--- @param image hs.image - The image to create the wallpaper with corners for.
--- @param screen hs.screen - The screen to create the wallpaper with corners for.
--- @return hs.image|nil - The wallpaper with corners.
local createWallpaperWithCorners = memoize(function(image, screen)
  local screenFrame = screen:fullFrame()
  local menubarHeight = windows.getMenuBarHeight(screen)

  local canvas = hs.canvas.new({
    x = screenFrame.x,
    y = screenFrame.y,
    w = screenFrame.w,
    h = screenFrame.h,
  })

  if not canvas then
    return
  end

  local canvasFrame = canvas:frame()
  local cornerData = getCornerData(canvasFrame, menubarHeight)
  local elements = getElements(image, canvasFrame, cornerData, menubarHeight)

  if canvas == nil then
    return
  end

  canvas
    :appendElements(elements)
    :behavior(hs.canvas.windowBehaviors.moveToActiveSpace)
    :level(hs.canvas.windowLevels.desktopIcon)

  local generatedWallpaper = canvas:imageFromCanvas()

  if generatedWallpaper == nil then
    canvas:delete()
    return
  end

  canvas:delete()

  return generatedWallpaper
end)

--- Gets all spaces.
--- @return number[]|string[] - All spaces.
local getAllSpaces = memoize(function()
  local spacesByDisplay = hs.spaces.data_managedDisplaySpaces()
  local allSpaces = hs.fnutils.reduce(spacesByDisplay, function(acc, spaces)
    local otherSpaces = hs.fnutils.map(spaces.Spaces, function(space)
      return space.id64
    end)

    return hs.fnutils.concat(acc, otherSpaces)
  end, {}) or {}

  return allSpaces
end)

--- Gets the space index for the given space id.
--- @param spaceId number - The space id to get the space index for.
--- @return number - The space index.
local getSpaceIndex = memoize(function(spaceId)
  local allSpaces = getAllSpaces()

  if not allSpaces then
    return 0
  end

  return hs.fnutils.indexOf(allSpaces, spaceId) or 0
end)

--- Applies the wallpaper at the given path.
--- @param path string - The path to apply the wallpaper from.
local applyWallpaper = function(path)
  local focusedWindow = hs.window.frontmostWindow()

  if not focusedWindow then
    return
  end

  focusedWindow:screen():desktopImageURL("file://" .. path)
end

local getCurrentSpace = function()
  local focusedWindow = hs.window.frontmostWindow()

  if not focusedWindow then
    return
  end

  return getSpaceIndex(hs.spaces.activeSpaceOnScreen(focusedWindow:screen()))
end

--- Generates the wallpaper for the current space.
local generateWallpaperForSpace = function()
  local focusedWindow = hs.window.frontmostWindow()

  if not focusedWindow then
    return
  end

  local screen = focusedWindow:screen()
  local currentSpace = getCurrentSpace()
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

--- Removes all wallpapers.
local removeAll = function()
  os.execute("rm", "-rf " .. wallpaperPrefixPath)
end

--- Generates the wallpaper UUIDs.
local generateWallpaperUUIDs = function()
  local spaces = getAllSpaces()

  if not spaces then
    return
  end

  for index, _ in ipairs(spaces) do
    wallpaperNameMap[index] = hs.hash.SHA1(hs.host.uuid() .. getLocalWallpaperPath(index))
  end
end

local module = {}

module.removeAll = removeAll

module.start = function()
  local init = function()
    removeAll()
    generateWallpaperUUIDs()
    generateWallpaperForSpace()
  end

  hs.spaces.watcher.new(generateWallpaperForSpace):start()
  hs.screen.watcher.newWithActiveScreen(init):start()

  init()
end

return module
