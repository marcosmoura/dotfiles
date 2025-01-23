return {
  {
    "lukas-reineke/virt-column.nvim",
    event = {
      "BufRead",
      "BufWinEnter",
      "BufNewFile",
    },
    config = function()
      require("virt-column").setup({
        char = "▕",
      })
    end,
  },
}
