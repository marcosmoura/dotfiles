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
          "TelescopePrompt",
          "neo-tree",
        },
      })
    end,
  },
}
