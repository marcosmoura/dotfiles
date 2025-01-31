local memoize = require("config.utils.memoize")
local os = require("config.utils.os")

local module = {}
local filters = {}

hs.window.filter.default:rejectApp("Stats")
hs.window.filter.default:rejectApp("Raycast")

--- Get current space windows
--- @return hs.window[]
local getCurrentSpaceWindows = function()
  local focusedWindow = hs.window.focusedWindow() or hs.window.frontmostWindow()

  if not focusedWindow then
    return {}
  end

  local space = hs.spaces.activeSpaceOnScreen(focusedWindow:screen())

  if not space then
    return {}
  end

  if filters[space] then
    return filters[space]:getWindows()
  end

  local filter = hs.window.filter
    .new(false)
    :setDefaultFilter({
      visible = true,
      allowRoles = "AXStandardWindow",
      allowScreens = focusedWindow:screen():getUUID(),
      fullscreen = false,
    })
    :setCurrentSpace(true)
    :rejectApp("Hammerspoon")
    :rejectApp("Stats")
    :rejectApp("Raycast")
    :setSortOrder(hs.window.filter.sortByCreatedLast)

  filters[space] = filter

  return filter:getWindows()
end

--- Get menu bar height
--- @param screen hs.screen
--- @return number
local getMenuBarHeight = memoize(function(screen)
  local screenFrame = screen:fullFrame()

  if not os.sketchybar.isRunning() then
    return screen:frame().y - screenFrame.y
  end

  local sketchyBarData = os.sketchybar.execute("--query bar", { json = true })

  return tonumber(sketchyBarData.height) + tonumber(sketchyBarData.y_offset)
end)

--- Get current active screen
--- @return hs.screen
local getActiveScreen = function()
  local currentApp = hs.application.frontmostApplication()
  local mainWindow = currentApp and currentApp:mainWindow()

  if not mainWindow then
    return hs.screen.mainScreen()
  end

  return currentApp:mainWindow():screen()
end

--- Get visible screen frame
--- @param _screen hs.screen
--- @return hs.geometry
local getVisibleScreenFrame = function(_screen)
  local screen = _screen or getActiveScreen()
  local screenFrame = screen:frame()
  local height = getMenuBarHeight(screen)

  return {
    x = screenFrame.x,
    y = height,
    w = screenFrame.w,
    h = screenFrame.h,
  }
end

module.getCurrentSpaceWindows = getCurrentSpaceWindows
module.getMenuBarHeight = getMenuBarHeight
module.getVisibleScreenFrame = getVisibleScreenFrame

return module
