local mappings = {
  mode = "n",
  { "<leader>q", "<cmd>confirm q<CR>", desc = "Quit" }, -- no need to specify mode since it's inherited
  { "<leader>w", "<cmd>w!<CR>", desc = "Save" },
  { "<leader>!", "<cmd>confirm q!<CR>", desc = "Force quit" },
}

return {
  "folke/which-key.nvim",
  dependencies = {
    "echasnovski/mini.icons",
    "nvim-tree/nvim-web-devicons",
  },
  cmd = "WhichKey",
  opts = {
    win = {
      padding = { 2, 2, 2, 2 },
    },
    layout = {
      align = "center",
    },
  },
  init = function()
    vim.o.timeout = true
    vim.o.timeoutlen = 400

    require("which-key").add(mappings)
  end,
}
