local hotkey = require 'hs.hotkey'
local window = require 'hs.window'
local applyWindowLayout = require 'dotfiles.layout'
local slowQuitApps = require 'dotfiles.slowquit'
local showDateAlert = require 'dotfiles.showdate'
local masterHotkey = {'cmd', 'alt', 'ctrl'}

function reloadWindowLayout ()
  hotkey.bind(masterHotkey, 'L', applyWindowLayout)
end

function showDate ()
  hotkey.bind(masterHotkey, 'D', showDateAlert)
end

return function ()
  reloadWindowLayout()
  showDate()
  slowQuitApps()
end
