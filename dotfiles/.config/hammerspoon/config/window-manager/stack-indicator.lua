local debounce = require("config.utils.debounce")
local executeYabai = require("config.utils.executeYabai")
local memoize = require("config.utils.memoize")

local canvasMap = {}
local indicator = {
  w = 40,
  h = 6,
  radius = 3,
}

local module = {}

local getSpaceData = function()
  local space = executeYabai("-m query --spaces --space", { json = true })
  local label = space.label
  local isStack = space.type == "stack"

  return label, isStack
end

local removeCanvasElements = function(canvas)
  while canvas:elementCount() > 0 do
    canvas:removeElement(1)
  end
end

local filters = {}

local getFilteredWindows = function()
  local focusedWindow = hs.window.focusedWindow()

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
    :setSortOrder(hs.window.filter.sortByCreatedLast)

  filters[space] = filter

  return filter:getWindows()
end

local setCanvasFrame = function(canvas, focusedWindow)
  local frame = focusedWindow:frame()

  canvas:frame({
    w = frame.w,
    h = indicator.h,
    x = frame.x,
    y = frame.y - (indicator.h * 2),
  })
end

local draw = memoize(function(canvas, windows)
  local focusedWindow = hs.window.focusedWindow()

  removeCanvasElements(canvas)

  if #windows < 2 or not focusedWindow then
    canvas:hide()
    return
  end

  setCanvasFrame(canvas, focusedWindow)

  for index, window in ipairs(windows) do
    local id = window:id()
    local isFocused = id == focusedWindow:id()

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
      id = id,
    })
  end

  canvas:show()
end)

local onWindowChanged = debounce(function()
  local label, isStack = getSpaceData()
  local canvas = canvasMap[label]

  if not canvas then
    return
  end

  if not isStack then
    canvas:hide()
    return
  end

  draw(canvas, getFilteredWindows())
end, 0.1)

local onIndicatorClick = function(_, _, id)
  local window = hs.window.get(id)

  if not window then
    return
  end

  window:focus()
end

local onSpaceChange = debounce(function()
  local label, isStack = getSpaceData()
  local canvas = canvasMap[label]

  if canvas or not isStack then
    return
  end

  canvas = hs.canvas.new({})
  canvasMap[label] = canvas

  if not canvas then
    return
  end

  canvas:mouseCallback(onIndicatorClick)
  canvas:level(hs.canvas.windowLevels.normal - 1)
  canvas:hide()

  draw(canvas, getFilteredWindows())
end, 0.1)

local onDisplayChange = debounce(function()
  canvasMap = {}
  onSpaceChange()
end, 0.1)

module.start = function()
  hs.ipc.localPort("yabai:onDisplaysChanged", onDisplayChange)
  hs.ipc.localPort("yabai:onSpacesChanged", onSpaceChange)
  hs.ipc.localPort("yabai:onWindowsChanged", onWindowChanged)
end

return module
