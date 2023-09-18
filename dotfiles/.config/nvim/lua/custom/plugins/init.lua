local lazy_events = {
  on_file_open = {
    "BufReadPost",
    "BufNewFile",
  },
  on_file_read = {
    "BufRead",
  },
}

return {
  -- Default plugins
  "folke/neodev.nvim",
  "nvim-lua/plenary.nvim",

  -- UI
  {
    "lukas-reineke/virt-column.nvim",
    event = lazy_events.on_file_open,
    config = function()
      require("virt-column").setup()
    end,
  },
  {
    "tribela/vim-transparent",
    event = "VimEnter",
  },
  {
    "lewis6991/satellite.nvim",
    opts = {
      excluded_filetypes = { "prompt", "neo-tree" },
    },
  },

  -- Highlight Items
  {
    "folke/todo-comments.nvim",
    event = lazy_events.on_file_open,
  },
  {
    "NvChad/nvim-colorizer.lua",
    event = lazy_events.on_file_open,
  },

  -- Git Blame
  {
    "f-person/git-blame.nvim",
    event = lazy_events.on_file_read,
  },

  -- Theme
  require("custom.plugins.catppuccin"),

  -- File Explorer
  require("custom.plugins.neo-tree"),
}
