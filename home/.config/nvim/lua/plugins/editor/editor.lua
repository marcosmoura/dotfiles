return {
  {
    "HiPhish/rainbow-delimiters.nvim",
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
