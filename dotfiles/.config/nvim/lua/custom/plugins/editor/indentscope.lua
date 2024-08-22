return {
  "echasnovski/mini.indentscope",
  version = false,
  event = {
    "BufRead",
    "BufWinEnter",
    "BufNewFile",
  },
  config = function()
    local indent = require("mini.indentscope")

    indent.setup({
      symbol = "│",
      options = {
        try_as_border = true,
      },
      draw = {
        delay = 0,
        animation = indent.gen_animation.exponential({
          duration = 8,
        }),
      },
    })
  end,
  init = function()
    vim.api.nvim_create_autocmd("FileType", {
      pattern = {
        "help",
        "alpha",
        "dashboard",
        "neo-tree",
        "Trouble",
        "lazy",
        "mason",
        "notify",
        "toggleterm",
        "lazyterm",
      },
      callback = function()
        vim.b.miniindentscope_disable = true
      end,
    })
  end,
}
