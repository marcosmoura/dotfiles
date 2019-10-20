function getFocusedWindow()
  return hs.window.focusedWindow()
end

function getScreenSize()
  return getFocusedWindow():screen():frame()
end

-- +------------------+
-- |         +------+ |
-- |         |      | |
-- |         | HERE | |
-- |         |      | |
-- |         +------+ |
-- +------------------+
function hs.window.right()
  local window = getFocusedWindow()
  local windowFrame = window:frame()
  local screenSize = getScreenSize()
  local width = screenSize.w / 2
  local height = screenSize.h

  windowFrame.x = width
  windowFrame.y = 0
  windowFrame.w = width
  windowFrame.h = height

  window:setFrame(windowFrame)
end

-- +------------------+
-- | +------+         |
-- | |      |         |
-- | | HERE |         |
-- | |      |         |
-- | +------+         |
-- +------------------+
function hs.window.left()
  local window = getFocusedWindow()
  local windowFrame = window:frame()
  local screenSize = getScreenSize()
  local width = screenSize.w / 2
  local height = screenSize.h

  windowFrame.x = 0
  windowFrame.y = 0
  windowFrame.w = width
  windowFrame.h = height

  window:setFrame(windowFrame)
end

-- +------------------+
-- | +--------------+ |
-- | |              | |
-- | |     HERE     | |
-- | |              | |
-- | +--------------+ |
-- +------------------+
function hs.window.fullscreen()
  local window = getFocusedWindow()
  local screenSize = getScreenSize()

  window:setFrame(screenSize)
end

-- +------------------+
-- |                  |
-- |   +----------+   |
-- |   |   HERE   |   |
-- |   +----------+   |
-- |                  |
-- +------------------+
function hs.window.center()
  local window = getFocusedWindow()
  local windowFrame = window:frame()
  local screenSize = getScreenSize()
  local width = 1440
  local height = 900

  windowFrame.x = screenSize.w / 2 - width / 2
  windowFrame.y = screenSize.h / 2 - height / 2
  windowFrame.w = width
  windowFrame.h = height

  window:setFrame(windowFrame)
  window:centerOnScreen(window:screen(), true)
end

return function ()
  local main = {'cmd', 'option'}

  hs.hotkey.bind(main, 'up', hs.window.fullscreen)
  hs.hotkey.bind(main, 'down', hs.window.center)
  hs.hotkey.bind(main, 'right', hs.window.right)
  hs.hotkey.bind(main, 'left', hs.window.left)
end
