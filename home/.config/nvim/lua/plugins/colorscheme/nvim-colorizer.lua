local names_enabled = {
  names = true,
}

return {
  {
    "NvChad/nvim-colorizer.lua",
    cond = function()
      return not vim.g.vscode
    end,
    event = "BufReadPre",
    opts = {
      filetypes = {
        "*",
        ["css"] = names_enabled,
        ["scss"] = names_enabled,
        ["javascript"] = names_enabled,
        ["typescript"] = names_enabled,
        ["javascriptreact"] = names_enabled,
        ["typescriptreact"] = names_enabled,
      },
      user_default_options = {
        RGB = true,
        RRGGBB = true,
        RRGGBBAA = true,
        AARRGGBB = false,
        rgb_fn = true,
        hsl_fn = true,
        css = true,
        css_fn = false,
        mode = "background",
        names = false,
        sass = {
          enable = false,
          parsers = { "css" },
        },
        virtualtext = "■",
        virtualtext_mode = "foreground",
        always_update = false,
      },
      buftypes = {},
    },
  },
}
