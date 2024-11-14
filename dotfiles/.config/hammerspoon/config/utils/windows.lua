local module = {}

local filters = {}

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
    :setSortOrder(hs.window.filter.sortByCreatedLast)

  filters[space] = filter

  return filter:getWindows()
end

module.getCurrentSpaceWindows = getCurrentSpaceWindows

return module
