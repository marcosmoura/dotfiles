local memoize = require("config.utils.memoize")
local os = require("config.utils.os")

local module = {}

hs.window.filter.default:rejectApp("Stats")
hs.window.filter.default:rejectApp("Raycast")

--- Create space filter
--- @param screen hs.screen
--- @return hs.window.filter
local createSpaceFilter = memoize(function(screen)
  return hs.window.filter
    .new(false)
    :setDefaultFilter({
      visible = true,
      allowRoles = "AXStandardWindow",
      allowScreens = screen:getUUID(),
      fullscreen = false,
      currentSpace = true,
    })
    :rejectApp("Hammerspoon")
    :rejectApp("Stats")
    :rejectApp("Raycast")
    :setSortOrder(hs.window.filter.sortByCreatedLast)
end)

--- Get current active screen
--- @return hs.screen
local getActiveScreen = function()
  local focusedWindow = hs.window.focusedWindow() or hs.window.frontmostWindow()

  if focusedWindow then
    return focusedWindow:screen()
  end

  local currentApp = hs.application.frontmostApplication()
  local mainWindow = currentApp and currentApp:mainWindow()

  if not mainWindow then
    return hs.screen.mainScreen()
  end

  return currentApp:mainWindow():screen()
end

--- Get current space windows
--- @return hs.window[]
local getCurrentSpaceWindows = function()
  local screen = getActiveScreen()
  local space = hs.spaces.activeSpaceOnScreen(screen)

  if not space then
    return {}
  end

  local filter = createSpaceFilter(screen)
  local windows = filter:getWindows()

  filter:pause()
  filter:unsubscribeAll()

  return windows
end

--- Get menu bar height
--- @return number
local getMenuBarHeight = memoize(function()
  local screen = hs.screen.mainScreen()

  if not os.sketchybar.isRunning() then
    local frame = screen:frame()
    local fullFrame = screen:fullFrame()

    return frame.y - fullFrame.y
  end

  local sketchyBarData = os.sketchybar.execute("--query bar", { json = true })

  return tonumber(sketchyBarData.height) + tonumber(sketchyBarData.y_offset)
end)

local hasNativeMenuBar = memoize(function(_screen)
  local screen = _screen or getActiveScreen()
  local screenFrame = screen:fullFrame()

  return (screen:frame().y - screenFrame.y) > 0
end)

--- Get visible screen frame
--- @param _screen hs.screen
--- @return hs.geometry
local getVisibleScreenFrame = function(_screen)
  local screen = _screen or getActiveScreen()
  local screenFrame = screen:frame()
  local height = getMenuBarHeight()

  return {
    x = screenFrame.x,
    y = height,
    w = screenFrame.w,
    h = screenFrame.h,
  }
end

module.getCurrentSpaceWindows = getCurrentSpaceWindows
module.getMenuBarHeight = getMenuBarHeight
module.hasNativeMenuBar = hasNativeMenuBar
module.getVisibleScreenFrame = getVisibleScreenFrame

return module
