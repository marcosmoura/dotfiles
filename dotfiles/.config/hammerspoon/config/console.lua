local colors = require("config.utils.colors")
local green = colors.green.hex

local module = {}

--- Prints all available colors in the Catppuccin palette
local printAvailableColors = function()
  local colorNames = {}

  for k, _ in pairs(colors) do
    table.insert(colorNames, k)
  end

  print("Available Catppuccin palette colors:")
  print(table.concat(colorNames, ", "))
end

module.start = function()
  hs.console.outputBackgroundColor({ hex = colors.crust.hex })
  hs.console.consolePrintColor({ hex = green })
  hs.console.consoleResultColor({ hex = green })
  hs.console.consoleCommandColor({ hex = green })
  hs.console.consoleFont({ name = "Maple Mono", size = 13.5 })
  hs.console.alpha(1)
  hs.console.darkMode(true)
  hs.console.clearConsole()

  if DEBUG then
    print("Catppuccin Dark Mode Enabled")
    printAvailableColors()
  end
end

return module
