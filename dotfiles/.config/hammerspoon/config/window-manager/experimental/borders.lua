local debounce = require("config.utils.debounce")

local drawFocusedWindowBorder = function(canvas)
  canvas:hide()

  local focusedWindow = hs.window.focusedWindow()

  if not focusedWindow then
    return
  end

  local focusedFrame = focusedWindow:frame()
  local strokeWidth = canvas[1].strokeWidth

  canvas[1].frame = {
    x = focusedFrame.x - strokeWidth,
    y = focusedFrame.y - strokeWidth,
    w = focusedFrame.w + strokeWidth * 2,
    h = focusedFrame.h + strokeWidth * 2,
  }
  canvas:show()
end

local setCanvas = function(canvas)
  if not canvas then
    return
  end

  canvas:level(hs.canvas.windowLevels.normal + 1)
  canvas:behavior(hs.canvas.windowBehaviors.canJoinAllSpaces)
  canvas:clickActivating(false)
  canvas:insertElement({
    type = "rectangle",
    action = "stroke",
    strokeColor = { hex = "#fff" },
    strokeWidth = 2.125,
    roundedRectRadii = { xRadius = 11, yRadius = 11 },
  })
  canvas:frame(hs.window.frontmostWindow():screen():fullFrame())
end

local module = {}

module.start = function()
  local canvas = hs.canvas.new({})

  local onChange = debounce(function()
    drawFocusedWindowBorder(canvas)
  end, 0.1)

  setCanvas(canvas)

  hs.window.filter
    .new(hs.window.filter.defaultCurrentSpace)
    :setOverrideFilter({
      visible = true,
      fullscreen = false,
      allowRoles = "AXStandardWindow",
      currentSpace = true,
    })
    :subscribe({
      hs.window.filter.windowAllowed,
      hs.window.filter.windowCreated,
      hs.window.filter.windowDestroyed,
      hs.window.filter.windowFocused,
      hs.window.filter.windowFullscreened,
      hs.window.filter.windowHidden,
      hs.window.filter.windowInCurrentSpace,
      hs.window.filter.windowMinimized,
      hs.window.filter.windowMoved,
      hs.window.filter.windowNotVisible,
      hs.window.filter.windowOnScreen,
      hs.window.filter.windowRejected,
      hs.window.filter.windowsChanged,
      hs.window.filter.windowUnfocused,
      hs.window.filter.windowVisible,
    }, onChange, true)

  hs.ipc.localPort("windowManager.tiling.onLayoutChanged", onChange)

  local prevPosition = {
    x = nil,
    y = nil,
  }

  hs.eventtap
    .new({
      hs.eventtap.event.types.leftMouseDragged,
    }, function()
      local focusedWindow = hs.window.focusedWindow()

      if not focusedWindow then
        return
      end

      local frame = focusedWindow:frame()

      if frame.x == prevPosition.x and frame.y == prevPosition.y then
        return
      end

      if not (prevPosition.x and prevPosition.y) then
        prevPosition = {
          x = frame.x,
          y = frame.y,
        }

        return
      end

      prevPosition = {
        x = frame.x,
        y = frame.y,
      }

      onChange()
    end)
    :start()
end

return module
