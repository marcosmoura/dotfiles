local prettier = { { "prettierd", "prettier" } }

return {
  {
    "stevearc/conform.nvim",
    opts = {
      default_format_opts = {
        timeout_ms = 500,
      },
      formatters_by_ft = {
        javascript = prettier,
        typescript = prettier,
        javascriptreact = prettier,
        typescriptreact = prettier,
        css = prettier,
        html = prettier,
        json = prettier,
        markdown = prettier,
        bash = "shfmt",
        sh = "shfmt",
        zsh = "shfmt",
        lua = "stylua",
        ["*"] = "codespell",
        ["_"] = "trim_whitespace",
      },
    },
  },
}
