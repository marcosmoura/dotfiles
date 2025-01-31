local colors = require("config.utils.colors")

local module = {}

module.start = function()
  hs.loadSpoon("SpoonInstall")

  spoon.SpoonInstall.use_syncinstall = true
  spoon.SpoonInstall:andUse("EmmyLua")
  spoon.SpoonInstall:andUse("ReloadConfiguration", {
    start = true,
  })
  spoon.SpoonInstall:updateAllRepos()
end

return module
