local alert = require("config.utils.alert")

local function getCurrentApp()
  return hs.application.frontmostApplication()
end

local module = {}

module.start = function()
  local killed = false

  spoon.SpoonInstall:andUse("HoldToQuit", {
    fn = function(holdToQuit)
      local currentAlert = nil

      local closeCurrentAlert = function()
        if currentAlert then
          hs.alert.closeSpecific(currentAlert)
          currentAlert = nil
        end
      end

      function holdToQuit:onKeyUp()
        if self.timer:running() then
          self.timer:stop()
          killed = false

          hs.timer.doAfter(0.5, closeCurrentAlert)
        end
      end

      function holdToQuit:onKeyDown()
        self.timer:start()

        local app = getCurrentApp()
        local appName = app:name()

        if appName == "Finder" then
          alert.warning("You can't quit Finder!", 1)
          return
        end

        currentAlert = alert.custom("Hold ⌘Q to quit " .. appName, nil, nil, 2)
      end

      holdToQuit.timer = hs.timer.delayed.new(1.5, function()
        local app = getCurrentApp()

        if app:name() == "Finder" then
          alert.warning("You can't quit Finder!", 1)
          return
        end

        if killed then
          return
        end

        app:kill()
        killed = true
        closeCurrentAlert()
      end)

      holdToQuit:start()
    end,
  })
end

return module
