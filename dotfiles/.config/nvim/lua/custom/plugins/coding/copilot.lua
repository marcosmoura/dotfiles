return {
  {
    "zbirenbaum/copilot.lua",
    cmd = "Copilot",
    event = {
      "BufRead",
      "BufWinEnter",
      "BufNewFile",
    },
    config = function()
      require("copilot").setup({
        suggestion = {
          auto_trigger = true,
          debounce = 0,
          keymap = {
            accept = "<C-l>",
            accept_word = false,
            accept_line = false,
            next = "<C-.>",
            prev = "<C-,>",
            dismiss = "<C/>",
          },
        },
      })
    end,
  },
}
