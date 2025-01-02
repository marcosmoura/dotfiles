local os = require("config.utils.os")

local module = {}

module.start = function()
  local _, status = os.execute(
    'hidutil property --set \'{"UserKeyMapping":[{"HIDKeyboardModifierMappingSrc": 0x700000039, "HIDKeyboardModifierMappingDst": 0x7000000E3}]}\'',
    {},
    { silent = true }
  )

  if not status then
    local title = "Key remapping failed"

    print(title .. "!", "Check with: " .. "hidutil property --get UserKeyMapping")
    hs.dialog.blockAlert(title, "Check Hammerspoon console")
  end
end

return module
