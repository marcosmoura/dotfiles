return {
  {
    "williamboman/mason.nvim",
    dependencies = {
      "WhoIsSethDaniel/mason-tool-installer.nvim",
    },
    event = {
      "BufRead",
      "BufWinEnter",
      "BufNewFile",
    },
    build = ":MasonToolsUpdate",
    config = function()
      local mason = require("mason")
      local mason_tool_installer = require("mason-tool-installer")

      mason.setup({
        ui = {
          border = "rounded",
          width = 0.8,
          height = 0.8,
          icons = {
            package_pending = " ",
            package_installed = " ",
            package_uninstalled = " ",
          },
        },

        max_concurrent_installers = 10,

        registries = {
          "lua:mason-registry.index",
          "github:mason-org/mason-registry",
        },
      })

      mason_tool_installer.setup({
        auto_update = true,
        run_on_start = true,
        ensure_installed = {
          "bash-language-server",
          "codespell",
          "css-lsp",
          "emmet-ls",
          "eslint_d",
          "html-lsp",
          "json-lsp",
          "lua-language-server",
          "luacheck",
          "marksman",
          "prettierd",
          "shellcheck",
          "shfmt",
          "stylua",
          "yaml-language-server",
        },
      })
    end,
  },
}
