local console = hs.console
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

module.catppuccinDarkMode = function()
  console.outputBackgroundColor({ hex = colors.crust.hex })
  console.consolePrintColor({ hex = green })
  console.consoleResultColor({ hex = green })
  console.consoleCommandColor({ hex = green })
  console.consoleFont({ name = "Maple Mono", size = 13.5 })
  console.alpha(1)
  console.darkMode(true)
  console.clearConsole()

  print_available_colors()
end

return tables.merge(console, module)
