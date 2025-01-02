local memoize = require("config.utils.memoize")
local windows = require("config.utils.windows")

local radius = 12

--- The current wallpaper.
--- @type hs.canvas|nil
local currentWallpaper = nil

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

--- Creates a wallpaper with corners for the given image and screen.
--- @param image hs.image - The image to create the wallpaper with corners for.
--- @param screen hs.screen - The screen to create the wallpaper with corners for.
--- @return hs.canvas|nil - The wallpaper with corners.
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

  return canvas
    :appendElements(elements)
    :behavior({
      hs.canvas.windowBehaviors.canJoinAllSpaces,
      hs.canvas.windowBehaviors.stationary,
    })
    :level(hs.canvas.windowLevels.normal)
end)

--- Gets a random wallpaper from the wallpaper directory.
--- @return string|nil - The random wallpaper.
local getRandomWallpaper = function()
  local wallpaperDirectory = "~/.config/wallpapers"
  local wallpaperPaths = {}

  for file in hs.fs.dir(wallpaperDirectory) do
    -- Ignore all files that are not .jpg, .jpeg, or .png files.
    if file:match(".*%.png$") or file:match(".*%.jpe?g$") then
      wallpaperPaths[#wallpaperPaths + 1] = wallpaperDirectory .. "/" .. file
    end
  end

  if #wallpaperPaths == 0 then
    return
  end

  return wallpaperPaths[math.random(#wallpaperPaths)]
end

--- Gets the wallpaper for the given space and screen.
--- @param screen hs.screen - The screen to get the wallpaper for.
--- @return hs.image|nil - The wallpaper.
local getWallpaperImage = memoize(function(wallpaperPath, screen)
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

local createWallpaper = function()
  local screen = hs.window.frontmostWindow():screen()
  local randomWallpaper = getRandomWallpaper()
  local image = getWallpaperImage(randomWallpaper, screen)

  if currentWallpaper then
    currentWallpaper:delete()
  end

  currentWallpaper = createWallpaperWithCorners(image, screen)
  currentWallpaper:show()
end

local raiseWallpaper = function()
  if currentWallpaper then
    currentWallpaper:level(hs.canvas.windowLevels.desktop)
    currentWallpaper:hide()
    currentWallpaper:level(hs.canvas.windowLevels.normal)
    currentWallpaper:show()
  end

  local focusedWindow = hs.window.frontmostWindow()
  --- @type hs.application|nil
  local app = focusedWindow:application()

  if app then
    hs.fnutils.each(app:allWindows(), function(window)
      window:raise()
    end)
  end
end

local module = {}

module.start = function()
  local init = function()
    createWallpaper()
    raiseWallpaper()
  end

  init()

  hs.screen.watcher.newWithActiveScreen(init):start()
  hs.ipc.localPort("aerospace:onWallpapersChanged", function()
    raiseWallpaper()
  end)

  -- Refresh the wallpaper every hour.
  hs.timer.doEvery(60 * 60, init)
end

return module
