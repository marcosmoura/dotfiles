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
        ["_"] = { "trim_whitespace" },
      },
    },
  },
}
