return {
  {
    "folke/lazydev.nvim",
    ft = "lua", -- only load on lua files
    opts = {
      library = {
        -- See the configuration section for more details
        -- Load luvit types when the `vim.uv` word is found
        { path = "${3rd}/luv/library", words = { "vim%.uv" } },
      },
    },
    config = function()
      require("lspconfig").lua_ls.setup({
        settings = {
          telemetry = {
            enable = false,
          },
          Lua = {
            runtime = {
              version = "Lua 5.3",
              path = {
                "?.lua",
                "?/init.lua",
                vim.fn.expand("~/.luarocks/share/lua/5.3/?.lua"),
                vim.fn.expand("~/.luarocks/share/lua/5.3/?/init.lua"),
                "/usr/share/5.3/?.lua",
                "/usr/share/lua/5.3/?/init.lua",
              },
            },
            workspace = {
              library = {
                vim.fn.expand("~/.luarocks/share/lua/5.3"),
                "/usr/share/lua/5.3",
              },
            },
          },
        },
      })
    end,
  },
  { -- optional cmp completion source for require statements and module annotations
    "hrsh7th/nvim-cmp",
    opts = function(_, opts)
      opts.sources = opts.sources or {}
      table.insert(opts.sources, {
        name = "lazydev",
        group_index = 0,
      })
    end,
  },
}
