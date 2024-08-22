return {
  {
    "b0o/SchemaStore.nvim",
    dependencies = {
      "neovim/nvim-lspconfig",
    },
    version = false,
    event = {
      "BufRead",
      "BufNewFile",
    },
    config = function()
      require("lspconfig").jsonls.setup({
        on_new_config = function(new_config)
          new_config.settings.json.schemas = new_config.settings.json.schemas or {}
          vim.list_extend(new_config.settings.json.schemas, require("schemastore").json.schemas())
        end,
        settings = {
          json = {
            format = {
              enable = true,
            },
            validate = { enable = true },
          },
        },
      })
    end,
  },
}
