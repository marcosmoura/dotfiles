return {
  {
    "lewis6991/satellite.nvim",
    cond = function()
      return not vim.g.vscode
    end,
    event = {
      "BufRead",
      "BufWinEnter",
      "BufNewFile",
    },
    config = function()
      require("satellite").setup({
        winblend = 0,
        excluded_filetypes = {
          "prompt",
          "snacks_picker",
          "snacks_notif",
          "snacks_dashboard",
          "yazi",
          "neo-tree",
          "lazy",
          "mason",
        },
      })
    end,
  },
}
