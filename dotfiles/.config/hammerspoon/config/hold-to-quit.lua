local alert = require("config.utils.alert")

local function getCurrentApp()
  return hs.application.frontmostApplication()
end

local module = {}

module.start = function()
  spoon.SpoonInstall:andUse("HoldToQuit", {
    fn = function(holdToQuit)
      function holdToQuit:onKeyUp()
        if self.timer:running() then
          self.timer:stop()

          alert.custom("Hold ⌘Q to quit " .. getCurrentApp():name(), nil, nil, 0.75)
        end
      end

      holdToQuit.timer = hs.timer.delayed.new(1.5, function()
        local app = getCurrentApp()

        if app:name() == "Finder" then
          alert.warning("You can't quit Finder!", 1)
          return
        end

        app:kill()
      end)

      holdToQuit:start()
    end,
  })
end

return module
