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

local createFocusedWindowBorderWatcher = function()
  local canvas = hs.canvas.new({})

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
    strokeWidth = 2.25,
    roundedRectRadii = { xRadius = 11, yRadius = 11 },
  })
  canvas:frame(hs.window.frontmostWindow():screen():fullFrame())

  local onChange = debounce(function()
    drawFocusedWindowBorder(canvas)
  end, 0.1)

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
end

local module = {}

module.start = function()
  createFocusedWindowBorderWatcher()
end

return module
