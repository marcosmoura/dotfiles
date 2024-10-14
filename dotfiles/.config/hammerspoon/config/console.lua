local colors = require("config.utils.colors")
local tables = require("jls.util.tables")
local green = colors.green.hex

local module = {}

local print_available_colors = function()
  local color_names = {}

  for k, _ in pairs(colors) do
    table.insert(color_names, k)
  end

  print("Available Catppuccin palette colors:")
  print(table.concat(color_names, ", "))
end

module.catppuccinDarkMode = function(print_colors)
  hs.console.outputBackgroundColor({ hex = colors.crust.hex })
  hs.console.consolePrintColor({ hex = green })
  hs.console.consoleResultColor({ hex = green })
  hs.console.consoleCommandColor({ hex = green })
  hs.console.consoleFont({ name = "Maple Mono", size = 13.5 })
  hs.console.alpha(1)
  hs.console.darkMode(true)
  hs.console.clearConsole()

  if print_colors then
    print_available_colors()
  end
end

return tables.merge(hs.console, module)
