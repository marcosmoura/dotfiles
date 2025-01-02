return {
  {
    "echasnovski/mini.doc",
    version = "*",
  },
  {
    "folke/lazydev.nvim",
    ft = "lua", -- only load on lua files
    opts = {
      library = {
        {
          path = "~/.config/hammerspoon/Spoons/EmmyLua.spoon/annotations",
          words = { "hs%." },
        },
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
                vim.api.nvim_get_runtime_file("", true),
                "/usr/share/lua/5.3",
              },
            },
          },
        },
      })
    end,
  },
}
