return {
  {
    "mfussenegger/nvim-lint",
    event = {
      "BufReadPre",
      "BufNewFile",
    },
    config = function()
      local lint = require("lint")

      lint.linters_by_ft = {
        javascript = { "eslint_d" },
        typescript = { "eslint_d" },
        javascriptreact = { "eslint_d" },
        typescriptreact = { "eslint_d" },
        css = { "stylelint" },
        html = { "stylelint" },
        json = { "jsonlint" },
        markdown = { "markdownlint" },
        bash = { "shellcheck" },
        sh = { "shellcheck" },
        zsh = { "shellcheck" },
        lua = { "luacheck" },
        ["*"] = { "codespell" },
        ["_"] = { "trim_whitespace" },
      }

      vim.api.nvim_create_autocmd({ "TextChanged", "InsertEnter" }, {
        group = vim.api.nvim_create_augroup("lint", { clear = true }),
        callback = function()
          lint.try_lint()
        end,
      })
    end,
  },
}
