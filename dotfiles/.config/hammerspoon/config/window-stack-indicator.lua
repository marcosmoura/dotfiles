local colors = require("config.utils.colors")
local debounce = require("config.utils.debounce")
local executeYabai = require("config.utils.executeYabai")

local spaces = {}
local indicator = {
  w = 40,
  h = 6,
  radius = 3,
}

local drawIndicators = function(canvas, filter)
  local space = executeYabai("-m query --spaces --space", { json = true })
  local layout = space["type"]

  if layout ~= "stack" then
    local focusedSpace = hs.spaces.focusedSpace()
    local spaceConfig = spaces[focusedSpace]

    if spaceConfig then
      spaceConfig.canvas:delete(hs.window.animationDuration)
      spaces[focusedSpace] = nil
    end

    return
  end

  local spaceWindows = filter:getWindows(hs.window.filter.sortByCreated)

  if #spaceWindows < 2 then
    canvas:hide()
    return
  end

  while canvas:elementCount() > 0 do
    canvas:removeElement(1)
  end

  local focusedWindow = hs.window.focusedWindow()
  local frame = focusedWindow:frame()

  canvas:frame({
    w = frame.w,
    h = indicator.h,
    x = frame.x,
    y = frame.y - (indicator.h * 2),
  })

  for index, window in ipairs(spaceWindows) do
    local isFocused = window == focusedWindow

    canvas:insertElement({
      type = "rectangle",
      fillColor = {
        hex = "#fff",
        alpha = isFocused and 1 or 0.3,
      },
      strokeColor = { alpha = 0 },
      strokeWidth = 0,
      roundedRectRadii = {
        xRadius = indicator.radius,
        yRadius = indicator.radius,
      },
      frame = {
        x = math.ceil((indicator.w + indicator.radius) * (index - 1)),
        y = 0,
        w = indicator.w,
        h = indicator.h,
      },
      trackMouseDown = true,
      id = window:id(),
    })
  end

  canvas:show()
end

local onIndicatorClick = function(_, _, id)
  local window = hs.window.get(id)

  if not window then
    return
  end

  window:focus()
end

local createSpaceFilter = function()
  local focusedSpace = hs.spaces.focusedSpace()
  local space = spaces[focusedSpace]

  if space then
    for key, spaceConfig in spaces do
      if key == focusedSpace then
        return
      end

      spaceConfig.canvas:hide()
    end

    drawIndicators(space.canvas, space.filter)

    return
  end

  spaces[focusedSpace] = {
    filter = hs.window.filter.new():setDefaultFilter(),
    canvas = hs.canvas.new({}),
  }

  local space = spaces[focusedSpace]

  if not space.canvas then
    return
  end

  space.canvas:mouseCallback(onIndicatorClick)
  space.canvas:level(hs.canvas.windowLevels.normal - 1)

  local onFilterChange = debounce(function()
    drawIndicators(space.canvas, space.filter)
  end, 0.1)

  space.filter
    :setOverrideFilter({
      visible = true,
      fullscreen = false,
      currentSpace = true,
      allowRoles = { "AXStandardWindow" },
    })
    :rejectApp("Hammerspoon")
    :rejectApp("System Preferences")
    :rejectApp("Notification Center")
    :subscribe({
      hs.window.filter.windowCreated,
      hs.window.filter.windowDestroyed,
      hs.window.filter.windowFocused,
      hs.window.filter.windowMinimized,
      hs.window.filter.windowMoved,
      hs.window.filter.windowsChanged,
      hs.window.filter.windowUnfocused,
    }, onFilterChange, true)
end

local module = {}

module.start = function()
  hs.spaces.watcher.new(createSpaceFilter):start()
  createSpaceFilter()
end

return module
