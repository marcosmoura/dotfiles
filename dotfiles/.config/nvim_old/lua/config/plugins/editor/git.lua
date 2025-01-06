local bold_line_left = "▎"
local triangle = "󰐊"

return {
  {
    "f-person/git-blame.nvim",
    event = {
      "BufRead",
    },
  },
  {
    "lewis6991/satellite.nvim",
    event = {
      "BufRead",
      "BufWinEnter",
      "BufNewFile",
    },
    config = function()
      require("satellite").setup({
        excluded_filetypes = {
          "prompt",
          "TelescopePrompt",
          "neo-tree",
        },
      })
    end,
  },
  {
    "lewis6991/gitsigns.nvim",
    event = {
      "BufRead",
      "BufWinEnter",
      "BufNewFile",
    },
    opts = {
      signs = {
        add = { text = bold_line_left },
        change = { text = bold_line_left },
        delete = { text = triangle },
        topdelete = { text = triangle },
        changedelete = { text = bold_line_left },
        untracked = { text = triangle },
      },
      signcolumn = true,
      numhl = false,
      linehl = false,
      word_diff = false,
      watch_gitdir = {
        interval = 500,
        follow_files = true,
      },
      attach_to_untracked = true,
      current_line_blame = false,
      current_line_blame_formatter = "<author>, <author_time:%Y-%m-%d> - <summary>",
      sign_priority = 6,
      status_formatter = nil,
      update_debounce = 100,
      max_file_length = 40000,
      preview_config = {
        border = "rounded",
        style = "minimal",
        relative = "cursor",
        row = 0,
        col = 1,
      },
    },
  },
}
