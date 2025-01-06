return {
  { import = "lazyvim.plugins.extras.util.mini-hipatterns" },
  { import = "lazyvim.plugins.extras.coding.neogen" },
  { import = "lazyvim.plugins.extras.coding.mini-comment" },
  { import = "lazyvim.plugins.extras.coding.mini-surround" },
  { import = "lazyvim.plugins.extras.coding.yanky" },

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
}
