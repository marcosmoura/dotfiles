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
        excluded_filetypes = {
          "prompt",
          "TelescopePrompt",
          "neo-tree",
        },
      })
    end,
  },
}
