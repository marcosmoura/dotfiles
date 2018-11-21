local hotkey = require "hs.hotkey"
local window = require "hs.window"
local applyWindowLayout = require "dotfiles.layout"

function focus ()
  hotkey.bind({'cmd', 'alt', 'ctrl'}, 'up', window.focusWindowNorth)
  hotkey.bind({'cmd', 'alt', 'ctrl'}, 'right', window.focusWindowEast)
  hotkey.bind({'cmd', 'alt', 'ctrl'}, 'down', window.focusWindowSouth)
  hotkey.bind({'cmd', 'alt', 'ctrl'}, 'left', window.focusWindowWest)
end

function reloadWindowLayout ()
  hotkey.bind({'cmd', 'alt', 'ctrl'}, 'L', applyWindowLayout)
end

return function ()
  focus()
  reloadWindowLayout()
end
