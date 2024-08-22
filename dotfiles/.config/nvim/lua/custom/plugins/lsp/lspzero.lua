return {
  {
    "VonHeikemen/lsp-zero.nvim",
    dependencies = {
      "pmizio/typescript-tools.nvim",
      "williamboman/mason-lspconfig.nvim",
    },
    event = {
      "BufRead",
      "BufWinEnter",
      "BufNewFile",
    },
    branch = "v3.x",
    init = function()
      -- Disable automatic setup, we are doing it manually
      vim.g.lsp_zero_extend_cmp = 0
      vim.g.lsp_zero_extend_lspconfig = 0
    end,
    config = function()
      local lsp_zero = require("lsp-zero")

      lsp_zero.extend_lspconfig()
      lsp_zero.extend_cmp()

      lsp_zero.on_attach(function(_, bufnr)
        lsp_zero.default_keymaps({
          buffer = bufnr,
        })
        lsp_zero.buffer_autoformat()
      end)

      require("mason-lspconfig").setup({
        handlers = {
          lsp_zero.default_setup,
          lua_ls = function()
            local lua_opts = lsp_zero.nvim_lua_ls()
            require("lspconfig").lua_ls.setup(lua_opts)
          end,
        },
      })

      require("typescript-tools").setup({})
    end,
  },
}
