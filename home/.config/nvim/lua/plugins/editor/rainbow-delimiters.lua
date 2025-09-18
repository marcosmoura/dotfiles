return {
  {
    "HiPhish/rainbow-delimiters.nvim",
    cond = function()
      return not vim.g.vscode
    end,
    event = { "BufReadPre", "BufNewFile" },
    config = function()
      require("rainbow-delimiters.setup").setup({
        query = {
          -- Use parentheses by default
          [""] = "rainbow-delimiters",
          tsx = "rainbow-parens",
          typescript = "rainbow-parens",
          javascript = "rainbow-parens",
          html = "rainbow-parens",
        },
      })
    end,
  },
}
