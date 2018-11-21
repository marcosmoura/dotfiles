local alert = require "hs.alert"
local config = require "dotfiles.config"
local hotkeys = require "dotfiles.hotkeys"
local layout = require "dotfiles.layout"
local watcher = require "dotfiles.watcher"

config()
hotkeys()
layout()
watcher()
alert.show("Hammerspoon at your service!", 1)
