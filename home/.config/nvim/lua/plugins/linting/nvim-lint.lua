local css = { "stylelint" }
local docs = { "markdownlint" }
local json = { "jsonlint" }
local shell = { "shellcheck" }

return {
  {
    "mfussenegger/nvim-lint",
    opts = {
      events = {
        "BufReadPost",
        "BufWritePost",
        "InsertEnter",
        "InsertLeave",
      },
      linters_by_ft = {
        bash = shell,
        css = css,
        html = css,
        json = json,
        lua = { "selene" },
        markdown = docs,
        sh = shell,
        zsh = shell,
      },
    },
  },

  {
    "neovim/nvim-lspconfig",
    opts = {
      servers = {
        eslint = {
          settings = {
            useFlatConfig = false,
          },
        },
      },
    },
  },
}
