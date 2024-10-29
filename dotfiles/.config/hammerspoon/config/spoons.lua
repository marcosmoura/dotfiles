local colors = require("config.utils.colors")

local module = {}

module.start = function()
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
  spoon.SpoonInstall:andUse("AllBrightness", {
    start = true,
  })
  spoon.SpoonInstall:andUse("ReloadConfiguration", {
    start = true,
  })
  spoon.SpoonInstall:updateAllRepos()
end

return module
