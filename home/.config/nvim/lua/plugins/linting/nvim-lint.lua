local default = {}
local css = { "stylelint" }
local js = default
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
        javascript = js,
        javascriptreact = js,
        json = { "jsonlint" },
        kdl = default,
        -- [work] lua not available
        -- lua = { "selene" },
        markdown = { "markdownlint" },
        -- [work] rust not available
        -- rust = default,
        sh = shell,
        typescript = js,
        typescriptreact = js,
        -- [work] yaml not available
        -- yaml = default,
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
