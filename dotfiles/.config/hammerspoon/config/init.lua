local colors = require("config.utils.colors")
local module = {}

local load_spoons = function()
  hs.loadSpoon("SpoonInstall")

  spoon.SpoonInstall.use_syncinstall = true
  spoon.SpoonInstall:andUse("EmmyLua")
  spoon.SpoonInstall:andUse("MiddleClickDragScroll", {
    start = true,
    config = {
      indicatorSize = 24,
      indicatorAttributes = {
        type = "circle",
        strokeColor = { alpha = 0 },
        fillColor = { hex = colors.surface2.hex, alpha = 0.5 },
      },
    },
  })
  spoon.SpoonInstall:andUse("ReloadConfiguration", {
    start = true,
  })
  spoon.SpoonInstall:andUse("PopupTranslateSelection", {
    config = {
      popup_style = hs.webview.windowMasks.utility
        | hs.webview.windowMasks.HUD
        | hs.webview.windowMasks.titled
        | hs.webview.windowMasks.closable
        | hs.webview.windowMasks.resizable,
    },
    hotkeys = {
      translate_to_en = { { "cmd", "alt", "ctrl" }, "t" },
    },
  })
  spoon.SpoonInstall:updateAllRepos()
end

module.setup = function()
  require("config.console").catppuccinDarkMode()

  load_spoons()

  local caffeinate = require("config.caffeinate")
  local caps_lock = require("config.caps-lock")
  local hide_notch = require("config.hide-notch")
  local hold_to_quit = require("config.hold-to-quit")
  local window_manager = require("config.window-manager")
  local audio = require("config.audio")

  audio.start()
  hold_to_quit.start()
  window_manager.start()
  hide_notch.start()
  caffeinate.start()
  caps_lock.start()

  require("config.utils.alert").custom("Configuration Reloaded!", "settings.png")
end

return module
