return {
  {
    "folke/lazydev.nvim",
    ft = "lua",
    cmd = "LazyDev",
    config = function()
      require("lspconfig").lua_ls.setup({
        library = {
          {
            path = "~/.config/hammerspoon/Spoons/EmmyLua.spoon/annotations",
            words = { "hs%." },
          },
          { path = "${3rd}/luv/library", words = { "vim%.uv" } },
          { path = "snacks.nvim", words = { "Snacks" } },
          { path = "lazy.nvim", words = { "LazyVim" } },
        },
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
