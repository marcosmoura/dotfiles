return {
  {
    "echasnovski/mini.base16",
    version = false,
    event = "VeryLazy",
  },
  {
    "catppuccin/nvim",
    name = "catppuccin",
    priority = 1000,
    opts = {
      no_italic = false,
      flavour = "mocha",
      dim_inactive = {
        enabled = true,
        percentage = 0.25,
      },
      custom_highlights = {
        TabLineFill = { link = "StatusLine" },
        LspInlayHint = { style = { "italic" } },
        ["@parameter"] = { style = {} },
        ["@type.builtin"] = { style = {} },
        ["@namespace"] = { style = {} },
        ["@text.uri"] = { style = { "underline" } },
        ["@tag.attribute"] = { style = {} },
        ["@tag.attribute.tsx"] = { style = {} },
      },
      integrations = {
        barbar = true,
        bufferline = true,
        cmp = true,
        gitsigns = true,
        illuminate = { enabled = true, lsp = true },
        lsp_saga = true,
        lsp_trouble = false,
        mason = true,
        mini = true,
        native_lsp = { enabled = true },
        neotree = true,
        noice = true,
        notify = true,
        nvimtree = true,
        telescope = { enabled = true },
        treesitter = true,
        which_key = true,
      },
    },
  },
}