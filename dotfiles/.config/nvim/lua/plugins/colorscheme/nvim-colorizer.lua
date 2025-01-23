return {
  {
    "NvChad/nvim-colorizer.lua",
    event = "BufReadPre",
    opts = {
      filetypes = { "*" },
      user_default_options = {
        RGB = true,
        RRGGBB = true,
        names = true,
        RRGGBBAA = true,
        AARRGGBB = false,
        rgb_fn = false,
        hsl_fn = true,
        css = true,
        css_fn = false,
        mode = "background",
        tailwind = true,
        sass = {
          enable = false,
          parsers = { "css" },
        },
        virtualtext = "■",
        always_update = false,
      },
      buftypes = {},
    },
  },
}
