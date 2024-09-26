local mappings = {
  normal = {
    w = { "<cmd>w!<CR>", "Save" },
    q = { "<cmd>confirm q<CR>", "Quit" },
    ["!"] = { "<cmd>confirm q!<CR>", "Force quit" },
  },
}

return {
  "folke/which-key.nvim",
  dependencies = { "echasnovski/mini.icons" },
  cmd = "WhichKey",
  event = "VeryLazy",
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

    require("which-key").register(mappings.normal, {
      mode = "n",
      prefix = "<leader>",
      buffer = nil,
      silent = true,
      noremap = true,
      nowait = true,
    })
  end,
}
