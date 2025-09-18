local memoize = require("config.utils.memoize")
local os = require("config.utils.os")
local windows = require("config.utils.windows")

local wallpaperPrefixPath = "/tmp/hammerspoon-temp/wallpapers/"
local radius = 16
local wallpaperNameMap = {}

--- Gets the elements for the given image, frame, corner data.
--- @param image hs.image The image to get the elements for.
--- @param screenFrame hs.geometry The frame of the screen.
--- @return table[] - The elements.
local function getCornerElements(image, screenFrame)
  local elements = {}
  local frame = {
    x = 0,
    y = 0,
    w = screenFrame.w,
    h = screenFrame.h,
  }

  elements[#elements + 1] = {
    type = "image",
    image = image,
    frame = frame,
    imageAlignment = "center",
    imageScaling = "scaleProportionally",
  }

  elements[#elements + 1] = {
    action = "build",
    type = "rectangle",
  }
  elements[#elements + 1] = {
    action = "clip",
    type = "rectangle",
    frame = frame,
    radius = radius,
    roundedRectRadii = { xRadius = radius, yRadius = radius },
    reversePath = true,
  }
  elements[#elements + 1] = {
    action = "fill",
    type = "rectangle",
    frame = frame,
    fillColor = {
      hex = "#000",
    },
  }
  elements[#elements + 1] = {
    type = "resetClip",
  }

  return elements
end

--- Gets the menubar background element
--- @param frame hs.geometry The frame to get the elements for.
--- @param menubarHeight number The menubar height.
--- @return table[] - The elements.
local function getMenubarElements(frame, menubarHeight)
  local elements = {}

  if menubarHeight ~= 0 then
    elements[#elements + 1] = {
      action = "fill",
      type = "rectangle",
      frame = {
        x = 0,
        y = 0,
        w = frame.w,
        h = menubarHeight,
      },
      fillColor = {
        alpha = 0.6,
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
  return "~/.config/wallpapers/" .. currentSpace .. ".png"
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
  local hasNativeMenubar = windows.hasNativeMenuBar(screen)
  local menubarHeight = windows.getMenuBarHeight()
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
  local cornerElements = getCornerElements(image, canvasFrame)
  local menubarElements = getMenubarElements(canvasFrame, menubarHeight)

  if canvas == nil then
    return
  end

  canvas
    :appendElements(cornerElements)
    :behavior(hs.canvas.windowBehaviors.moveToActiveSpace)
    :level(hs.canvas.windowLevels.desktopIcon)

  if hasNativeMenubar then
    canvas:appendElements(menubarElements)
  end

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
  local wallpaperPath = wallpaperPrefixPath .. wallpaperNameMap[currentSpace] .. ".png"

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

local changeWallpaper = function()
  removeAll()
  generateWallpaperUUIDs()
  generateWallpaperForSpace()
end

local module = {}

module.removeAll = removeAll
module.changeWallpaper = changeWallpaper

module.start = function()
  hs.spaces.watcher.new(generateWallpaperForSpace):start()
  hs.screen.watcher.newWithActiveScreen(changeWallpaper):start()
  changeWallpaper()
end

return module
