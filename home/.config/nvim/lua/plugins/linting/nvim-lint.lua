local lint_events = {
  "BufReadPost",
  "BufWritePost",
  "InsertEnter",
  "InsertLeave",
}

return {
  {
    "mfussenegger/nvim-lint",
    opts = {
      events = lint_events,
      linters_by_ft = {
        bash = { "cspell", "shellcheck" },
        css = { "cspell", "stylelint" },
        html = { "cspell", "stylelint" },
        javascript = { "cspell", "eslint_d" },
        javascriptreact = { "cspell", "eslint_d" },
        json = { "cspell", "jsonlint" },
        kdl = { "cspell" },
        lua = { "cspell" },
        markdown = { "cspell", "markdownlint" },
        rust = { "cspell" },
        sh = { "cspell", "shellcheck" },
        typescript = { "cspell", "eslint_d" },
        typescriptreact = { "cspell", "eslint_d" },
        yaml = { "cspell" },
        zsh = { "cspell", "shellcheck" },
      },
    },
    init = function()
      vim.api.nvim_create_autocmd(lint_events, {
        group = vim.api.nvim_create_augroup("lint", { clear = true }),
        callback = function()
          require("lint").try_lint()
        end,
      })
    end,
  },
}
