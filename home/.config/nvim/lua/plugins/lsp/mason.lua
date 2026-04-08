return {
  {
    "mason-org/mason.nvim",
    opts = {
      ui = {
        border = "rounded",
      },
      ensure_installed = {
        "bash-language-server",
        -- [work] cspell not available
        -- "cspell",
        "css-lsp",
        "emmet-ls",
        "eslint-lsp",
        "html-lsp",
        "json-lsp",
        -- [work] lua not available: lua-language-server, luacheck, selene, stylua
        "markdown-toc",
        "marksman",
        "oxlint",
        "prettier",
        -- [work] rust not available: rust-analyzer
        "shellcheck",
        "shfmt",
        -- [work] yaml not available: yaml-language-server
      },
    },
  },
}
