return {
  {
    "akinsho/bufferline.nvim",
    event = "VeryLazy",
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
