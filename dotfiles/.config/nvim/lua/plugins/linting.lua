return {
  {
    "mfussenegger/nvim-lint",
    opts = {
      linters_by_ft = {
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
      },
    },
    init = function()
      local lint = require("lint")

      vim.api.nvim_create_autocmd({ "TextChanged", "InsertEnter", "InsertLeave" }, {
        group = vim.api.nvim_create_augroup("lint", { clear = true }),
        callback = function()
          lint.try_lint()
        end,
      })
    end,
  },
}
