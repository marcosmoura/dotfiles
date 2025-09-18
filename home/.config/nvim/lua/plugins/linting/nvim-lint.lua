local default = { "cspell" }
local css = { "cspell", "stylelint" }
local js = default
local shell = { "cspell", "shellcheck" }

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
        javascript = js,
        javascriptreact = js,
        json = { "cspell", "jsonlint" },
        kdl = default,
        lua = { "cspell", "selene" },
        markdown = { "cspell", "markdownlint" },
        rust = default,
        sh = shell,
        typescript = js,
        typescriptreact = js,
        yaml = default,
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
