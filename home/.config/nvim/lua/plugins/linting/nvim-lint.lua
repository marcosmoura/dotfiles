local css = { "stylelint" }
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
        json = { "jsonlint" },
        lua = { "selene" },
        markdown = { "markdownlint" },
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
