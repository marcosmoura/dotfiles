return {
  {
    "sQVe/sort.nvim",
    cond = function()
      return not vim.g.vscode
    end,
    event = { "BufReadPre", "BufNewFile" },
    config = function()
      require("sort").setup()
    end,
    keys = {
      { "<leader>cs", "<Esc><Cmd>Sort<CR>", desc = "Sort lines", mode = "v" },
      { "<leader>cS", "<Esc><Cmd>Sort u<CR>", desc = "Sort lines (unique)", mode = "v" },
    },
  },

  {
    "2nthony/sortjson.nvim",
    cond = function()
      return not vim.g.vscode
    end,
    cmd = {
      "SortJSONByAlphaNum",
      "SortJSONByAlphaNumReverse",
    },
    config = function()
      require("sortjson").setup()
    end,
  },
}
