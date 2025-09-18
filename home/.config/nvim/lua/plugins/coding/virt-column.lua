return {
  {
    "lukas-reineke/virt-column.nvim",
    cond = function()
      return not vim.g.vscode
    end,
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
