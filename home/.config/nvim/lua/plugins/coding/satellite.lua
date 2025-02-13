return {
  {
    "lewis6991/satellite.nvim",
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
