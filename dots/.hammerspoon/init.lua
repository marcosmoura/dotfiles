local alert = require 'hs.alert'
local config = require 'dotfiles.config'
local hotkeys = require 'dotfiles.hotkeys'
local layout = require 'dotfiles.layout'
local watcher = require 'dotfiles.watcher'
local window = require 'dotfiles.window'

config()
hotkeys()
layout()
watcher()
window()
alert.show('Hammerspoon at your service!', 1.5)
