local hotkey = require 'hs.hotkey'
local window = require 'hs.window'
local applyWindowLayout = require 'dotfiles.layout'

function reloadWindowLayout ()
  hotkey.bind({'cmd', 'alt', 'ctrl'}, 'L', applyWindowLayout)
end

return function ()
  reloadWindowLayout()
end
