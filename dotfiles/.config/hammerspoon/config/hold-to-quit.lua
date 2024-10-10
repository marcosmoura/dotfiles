local alert = require("config.utils.alert")
local application = require("hs.application")
local timer = require("hs.timer")

local function get_current_app()
  return application.frontmostApplication()
end

spoon.SpoonInstall:andUse("HoldToQuit", {
  fn = function(hold_to_quit)
    function hold_to_quit:onKeyUp()
      if self.timer:running() then
        self.timer:stop()

        alert.custom("Hold ⌘Q to quit " .. get_current_app():name(), nil, nil, 0.75)
      end
    end

    hold_to_quit.timer = timer.delayed.new(1.5, function()
      local app = get_current_app()

      if app:name() == "Finder" then
        alert.warning("You can't quit Finder!", 1)
        return
      end

      app:kill()
    end)
    hold_to_quit:start()
  end,
})
