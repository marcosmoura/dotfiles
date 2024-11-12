local debounce = require("config.utils.debounce")
local deepMerge = require("config.utils.deepMerge")
local memoize = require("config.utils.memoize")

local onLayoutChangedIpc = hs.ipc.remotePort("windowManager.tiling.onLayoutChanged")
local gaps = 20
local config = {
  {
    name = "Files",
    apps = {
      "Finder",
    },
    layout = "tile",
  },
  {
    name = "Terminal",
    apps = {
      "WezTerm",
    },
    layout = "tile",
  },
  {
    name = "Code",
    apps = {
      "Code",
    },
    layout = "stack",
  },
  {
    name = "Browser",
    apps = {
      "Arc",
      "Safari",
      "Edge",
    },
    layout = "stack",
  },
  {
    name = "Design",
    apps = {
      "Figma",
    },
    layout = "stack",
  },
  {
    name = "Music",
    apps = {
      "Spotify",
      "Music",
    },
    layout = "stack",
  },
  {
    name = "Communication",
    apps = {
      {
        name = "Microsoft Teams",
        hasTitlebar = true,
      },
      "WhatsApp",
    },
    layout = "float",
  },
  {
    name = "Mail",
    apps = {
      {
        name = "Microsoft Outlook",
        hasTitlebar = true,
        rejectTitles = {
          "Reminder",
        },
      },
    },
    layout = "tile",
  },
  {
    name = "Productivity",
    apps = {
      "Proton Pass",
    },
    layout = "tile",
  },
  {
    name = "Misc",
    apps = {
      "Company Portal",
    },
    layout = "tile",
  },
}

local getAllSpaces = function()
  local spacesByDisplay = hs.spaces.data_managedDisplaySpaces()
  local allSpaces = hs.fnutils.reduce(spacesByDisplay, function(acc, spaces)
    local currentSpace = spaces["Current Space"]
    local otherSpaces = hs.fnutils.map(spaces.Spaces, function(space)
      return {
        id = space.id64,
        uuid = space.uuid,
        current = space.id64 == currentSpace.id64,
      }
    end)

    return hs.fnutils.concat(acc, otherSpaces)
  end, {}) or {}

  table.sort(allSpaces, function(a, b)
    return a.id < b.id
  end)

  return allSpaces
end

local getInsetScreenFrame = function()
  local screen = hs.screen.mainScreen()
  local screenFrame = screen:frame()

  -- Adjust the initial frame to account for the gaps around the edges
  screenFrame.x = screenFrame.x + gaps
  screenFrame.y = screenFrame.y + gaps
  screenFrame.w = screenFrame.w - 2 * gaps
  screenFrame.h = screenFrame.h - 2 * gaps

  return screenFrame
end

-- Original functions
local function stackWindows(windows)
  local screenFrame = getInsetScreenFrame()

  for _, window in ipairs(windows) do
    window:setFrame(screenFrame)
  end
end

local function tileWindows(windows)
  local screenFrame = getInsetScreenFrame()

  local function bsp(windows, frame)
    if #windows == 0 then
      return
    end

    if #windows == 1 then
      windows[1]:setFrame(frame)
      return
    end

    local half = math.floor(#windows / 2)
    local firstHalf = { table.unpack(windows, 1, half) }
    local secondHalf = { table.unpack(windows, half + 1) }

    local newFrame1, newFrame2
    if frame.w > frame.h then
      -- Vertical split
      newFrame1 = hs.geometry.rect(frame.x, frame.y, frame.w / 2 - gaps / 2, frame.h)
      newFrame2 = hs.geometry.rect(frame.x + frame.w / 2 + gaps / 2, frame.y, frame.w / 2 - gaps / 2, frame.h)
    else
      -- Horizontal split
      newFrame1 = hs.geometry.rect(frame.x, frame.y, frame.w, frame.h / 2 - gaps / 2)
      newFrame2 = hs.geometry.rect(frame.x, frame.y + frame.h / 2 + gaps / 2, frame.w, frame.h / 2 - gaps / 2)
    end

    bsp(firstHalf, newFrame1)
    bsp(secondHalf, newFrame2)
  end

  bsp(windows, screenFrame)
end

-- Memoize the functions
stackWindows = memoize(stackWindows)
tileWindows = memoize(tileWindows)

local applyLayout = function(layout, windows)
  if layout == "float" or #windows == 0 then
    return
  end

  if onLayoutChangedIpc then
    onLayoutChangedIpc:sendMessage(layout, 0)
  end

  if layout == "tile" then
    if #windows == 1 then
      stackWindows(windows)
      return
    end

    tileWindows(windows)
    return
  end

  if layout == "stack" then
    stackWindows(windows)
  end
end

local getAppFilter = function(app)
  local defaultFilter = {
    visible = true,
    fullscreen = false,
    allowRoles = { "AXStandardWindow", "AXWindow" },
  }

  if type(app) == "table" then
    local filter = deepMerge(defaultFilter, {
      rejectTitles = app.rejectTitles,
      hasTitlebar = app.hasTitlebar,
      allowTitles = app.allowTitles,
      allowScreens = app.allowScreens,
      rejectScreens = app.rejectScreens,
      allowRoles = app.allowRoles,
    })

    return app.name, filter
  end

  return app, defaultFilter
end

local module = {}

module.start = function()
  local allSpaces = getAllSpaces()
  local filters = {}

  for index, _ in ipairs(allSpaces) do
    local spaceConfig = config[index]

    if not spaceConfig then
      break
    end

    local filter = hs.window.filter.new(false):setCurrentSpace(true):setSortOrder(hs.window.filter.sortByCreatedLast)
    local apps = spaceConfig.apps or {}

    for _, app in ipairs(apps) do
      local appName, appFilter = getAppFilter(app)

      filter:setAppFilter(appName, appFilter)
    end

    filter:subscribe(
      {
        hs.window.filter.windowAllowed,
        hs.window.filter.windowCreated,
        hs.window.filter.windowDestroyed,
        hs.window.filter.windowFocused,
        hs.window.filter.windowHidden,
        hs.window.filter.windowMinimized,
        hs.window.filter.windowMoved,
        hs.window.filter.windowRejected,
        hs.window.filter.windowsChanged,
        hs.window.filter.windowUnfocused,
      },
      debounce(function()
        applyLayout(spaceConfig.layout, filter:getWindows())
      end, 0.02),
      true
    )

    filters[index] = filter
  end

  local getCurrentSpaceIndex = function()
    local currentSpace = hs.spaces.activeSpaceOnScreen()

    for index, space in ipairs(allSpaces) do
      if space.id == currentSpace then
        return index
      end
    end

    return 1
  end

  local getFilterWindowsBySpaceIndex = function(spaceIndex)
    return filters[spaceIndex]:getWindows()
  end

  local applyNewLayout = function(newLayout)
    local spaceIndex = getCurrentSpaceIndex()
    local windows = getFilterWindowsBySpaceIndex(spaceIndex)

    config[spaceIndex].layout = newLayout

    applyLayout(newLayout, windows)
  end

  hs.hotkey.bind({ "cmd", "ctrl" }, "m", function()
    applyNewLayout("stack")
  end)

  hs.hotkey.bind({ "cmd", "ctrl" }, "b", function()
    applyNewLayout("tile")
  end)

  hs.hotkey.bind({ "cmd", "ctrl" }, "f", function()
    local spaceIndex = getCurrentSpaceIndex()

    config[spaceIndex].layout = "float"
  end)
end

return module
