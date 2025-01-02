local debounce = require("config.utils.debounce")
local memoize = require("config.utils.memoize")
local os = require("config.utils.os")
local windows = require("config.utils.windows")

local canvasMap = {}
local indicator = {
  w = 40,
  h = 6,
  radius = 3,
}

local module = {}

--- Gets all windows in the current space.
--- @return hs.window[]
local getAllWindows = function()
  if os.yabai.isRunning() then
    return windows.getCurrentSpaceWindows()
  end

  if os.aerospace.isRunning() then
    local windows = os.aerospace.execute("list-windows --workspace focused --json", { format = "json" })

    return hs.fnutils.map(windows, function(window)
      return hs.window(window["window-id"])
    end) or {}
  end

  return {}
end

--- Gets the current space data.
--- @return string, boolean - The space label and whether the space is a stack.
local getSpaceData = function()
  if os.yabai.isRunning() then
    local space = os.yabai.execute("-m query --spaces --space", { json = true })
    local label = space.label
    local isStack = space.type == "stack"

    return label, isStack
  end

  if os.aerospace.isRunning() then
    local label = os.aerospace.execute("list-workspaces --focused", { format = "string" })
    local isStack = label ~= "communication"

    if type(label) == "string" then
      return label, isStack
    end

    return "", isStack
  end

  return "", false
end

--- Removes all elements from the canvas.
--- @param canvas hs.canvas The canvas to remove elements from.
local removeCanvasElements = function(canvas)
  while canvas:elementCount() > 0 do
    canvas:removeElement(1)
  end
end

--- Sets the frame of the canvas based on the focused window's frame.
--- @param canvas hs.canvas The canvas to set the frame for.
--- @param focusedWindow hs.window The currently focused window.
--- @param windows hs.window[] The windows to draw indicators for.
local setCanvasFrame = function(canvas, focusedWindow, windows)
  local frame = {}

  if os.yabai.isRunning() then
    frame = focusedWindow:frame()
  else
    frame = windows[1]:frame()
  end

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

  setCanvasFrame(canvas, focusedWindow, windows)

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

--- Debounced function to handle window changes.
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

  draw(canvas, getAllWindows())
end, 0.1)

--- Handles the click event on the indicator.
--- @param _ hs.canvas The canvas.
--- @param __ string The event type.
--- @param id number The window id.
local onIndicatorClick = function(_, __, id)
  local window = hs.window.get(id)

  if not window then
    return
  end

  window:focus()
end

--- Debounced function to handle space changes.
local onSpaceChange = debounce(function()
  local label, isStack = getSpaceData()
  local canvas = canvasMap[label]
  local allWindows = getAllWindows()

  for _, canvas in pairs(canvasMap) do
    canvas:hide()
  end

  if canvas then
    draw(canvas, allWindows)
    return
  end

  if not isStack then
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

  draw(canvas, allWindows)
end, 0.1)

--- Debounced function to handle display changes.
local onDisplayChange = debounce(function()
  canvasMap = {}
  onSpaceChange()
end, 0.1)

module.start = function()
  hs.ipc.localPort("yabai:onDisplaysChanged", onDisplayChange)
  hs.ipc.localPort("yabai:onSpacesChanged", onSpaceChange)
  hs.ipc.localPort("yabai:onWindowsChanged", onWindowChanged)

  hs.ipc.localPort("aerospace:onSpacesChanged", onSpaceChange)
  hs.ipc.localPort("aerospace:onWindowsChanged", onWindowChanged)
end

return module
