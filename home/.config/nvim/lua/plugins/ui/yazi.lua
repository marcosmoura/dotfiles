return {
  {
    "mikavilpas/yazi.nvim",
    cond = function()
      return vim.fn.executable("yazi") and not vim.g.vscode
    end,
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
