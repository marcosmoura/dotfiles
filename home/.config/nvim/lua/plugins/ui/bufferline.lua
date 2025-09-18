return {
  {
    "akinsho/bufferline.nvim",
    event = "VeryLazy",
    -- TODO: Remove this once https://github.com/LazyVim/LazyVim/pull/6354 is merged
    init = function()
      local bufline = require("catppuccin.groups.integrations.bufferline")
      bufline.get = bufline.get_theme
    end,
    ---@module 'bufferline'
    ---@type bufferline.Config
    opts = {
      options = {
        always_show_bufferline = true,
        close_icon = " ",
        buffer_close_icon = " ",
        hover = {
          enabled = true,
          delay = 120,
          reveal = { "close" },
        },
      },
    },
  },
}
