return {
  "stevearc/conform.nvim",
  event = {
    "BufRead",
    "BufWinEnter",
    "BufNewFile",
  },
  config = function()
    local conform = require("conform")

    local formatter_options = {
      lsp_fallback = true,
      async = false,
      timeout = 500,
    }
    local prettier = { { "prettierd", "prettier" } }

    local format = function()
      conform.format(formatter_options)
    end

    conform.setup({
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
        lua = { "stylua" },
        ["*"] = { "codespell" },
        ["_"] = { "trim_whitespace" },
      },
    })

    require("which-key").register({
      ["<leader>"] = {
        c = {
          name = "Code actions",
          f = {
            format,
            "Format code",
          },
        },
      },
    })

    vim.api.nvim_create_autocmd("BufWritePre", {
      pattern = "*",
      callback = format,
    })
  end,
}
