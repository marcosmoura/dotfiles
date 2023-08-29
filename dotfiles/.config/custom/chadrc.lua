---@type ChadrcConfig
local config = {
  ui = {
    theme = 'catppuccin',

    statusline = {
      theme = "vscode_colored",
    },

    tabufline = {
      lazyload = true,
    },
  },

  plugins = "custom.plugins",
  mappings = require "custom.mappings"
}

return config
