return {
  "nvimdev/lspsaga.nvim",
  dependencies = {
    "nvim-treesitter/nvim-treesitter",
    "nvim-tree/nvim-web-devicons",
  },
  event = {
    "BufRead",
    "BufWinEnter",
    "BufNewFile",
  },
  config = function()
    require("lspsaga").setup({
      ui = {
        kind = require("catppuccin.groups.integrations.lsp_saga").custom_kind(),
      },
      symbol_in_winbar = {
        enable = false,
      },
    })

    require("which-key").add({
      mode = "n",
      {
        "<leader>lt",
        group = "terminal",
        { "<leader>ltf", "<cmd>Lspsaga term_toggle<CR>", desc = "Floating Terminal" },
      },
    })
  end,
}
