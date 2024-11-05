local debounce = require("config.utils.debounce")
local executeYabai = require("config.utils.executeYabai")

local spaces = {}
local indicator = {
  w = 40,
  h = 6,
  radius = 3,
}

local onIndicatorClick = function(_, _, id)
  local window = hs.window.get(id)

  if not window then
    return
  end

  window:focus()
end

local removeCanvasElements = function(canvas)
  while canvas:elementCount() > 0 do
    canvas:removeElement(1)
  end
end

local getSpaceData = function()
  local space = executeYabai("-m query --spaces --space", { json = true })
  local label = space["label"]
  local isStack = space["type"] == "stack"

  return label, isStack
end

local drawIndicators = function(spaceConfig, isStack)
  local filter = spaceConfig.filter
  local canvas = spaceConfig.canvas
  local windows = filter:getWindows()

  removeCanvasElements(canvas)

  if not isStack or #windows < 2 then
    canvas:hide()
    return
  end

  local focusedWindow = hs.window.focusedWindow()

  if not focusedWindow then
    return
  end

  local frame = focusedWindow:frame()

  canvas:frame({
    w = frame.w,
    h = indicator.h,
    x = frame.x,
    y = frame.y - (indicator.h * 2),
  })

  for index, window in ipairs(windows) do
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

local onFilterChange = debounce(function()
  local label, isStack = getSpaceData()

  drawIndicators(spaces[label], isStack)
end, 0.1)

local createCurrentSpaceData = function()
  local label, isStack = getSpaceData()

  if spaces[label] then
    drawIndicators(spaces[label], isStack)

    return
  end

  spaces[label] = {
    filter = hs.window.filter.new(),
    canvas = hs.canvas.new({}),
  }

  local space = spaces[label]

  if not space.canvas then
    return
  end

  space.canvas:mouseCallback(onIndicatorClick)
  space.canvas:level(hs.canvas.windowLevels.normal - 1)

  space.filter
    :setDefaultFilter()
    :setSortOrder(hs.window.filter.sortByCreated)
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
      hs.window.filter.windowAllowed,
      hs.window.filter.windowCreated,
      hs.window.filter.windowDestroyed,
      hs.window.filter.windowFocused,
      hs.window.filter.windowInCurrentSpace,
      hs.window.filter.windowMinimized,
      hs.window.filter.windowMoved,
      hs.window.filter.windowRejected,
      hs.window.filter.windowsChanged,
      hs.window.filter.windowTitleChanged,
      hs.window.filter.windowUnfocused,
    }, onFilterChange, true)
end

local module = {}

module.start = function()
  hs.spaces.watcher.new(createCurrentSpaceData):start()
  createCurrentSpaceData()
end

return module
