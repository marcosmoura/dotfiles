local hotkey = require 'hs.hotkey'
local window = require 'hs.window'
local applyWindowLayout = require 'dotfiles.layout'
local slowQuitApps = require 'dotfiles.slowquit'
local masterHotkey = {'cmd', 'alt', 'ctrl'}

function reloadWindowLayout ()
  hotkey.bind(masterHotkey, 'L', applyWindowLayout)
end

return function ()
  reloadWindowLayout()
  slowQuitApps()
end
