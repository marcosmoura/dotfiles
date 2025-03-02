return {
  {
    "LazyVim/LazyVim",
    opts = {
      diagnostics = {
        icons = {
          Error = " ",
          Warn = " ",
          Hint = " ",
          Info = " ",
        },
      },
    },
  },

  {
    "mikavilpas/yazi.nvim",
    event = "VeryLazy",
    keys = {
      {
        "-",
        "<cmd>Yazi<cr>",
        desc = "Open yazi at the current file",
      },
      {
        "<leader>-",
        "<cmd>Yazi<cr>",
        desc = "Open yazi at the current file",
      },
      {
        "<leader>e",
        "<cmd>Yazi<cr>",
        desc = "Open yazi at the current file",
      },
      {
        "<leader>E",
        "<cmd>Yazi cwd<cr>",
        desc = "Open yazi at the root directory",
      },
    },
    opts = {
      floating_window_scaling_factor = 0.8,
      keymaps = {
        show_help = "<f1>",
      },
    },
  },
}
