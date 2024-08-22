return {
  {
    "echasnovski/mini.trailspace",
    event = {
      "BufRead",
      "BufWinEnter",
      "BufNewFile",
    },
    config = function()
      require("mini.trailspace").setup()
    end,
  },
  {
    "folke/trouble.nvim",
    event = "VeryLazy",
    cmd = { "Trouble", "TroubleToggle" },
  },
}
