return {
  {
    "catppuccin/nvim",
    name = "catppuccin",
    priority = 1000,
    opts = {
      -- transparent_background = true,
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
        aerial = true,
        alpha = true,
        cmp = true,
        dashboard = true,
        flash = true,
        fzf = true,
        grug_far = true,
        gitsigns = true,
        headlines = true,
        illuminate = true,
        indent_blankline = { enabled = true },
        leap = true,
        lsp_trouble = true,
        mason = true,
        markdown = true,
        mini = true,
        native_lsp = {
          enabled = true,
          underlines = {
            errors = { "undercurl" },
            hints = { "undercurl" },
            warnings = { "undercurl" },
            information = { "undercurl" },
          },
        },
        navic = { enabled = true, custom_bg = "lualine" },
        neotest = true,
        neotree = true,
        noice = true,
        notify = true,
        semantic_tokens = true,
        snacks = true,
        telescope = true,
        treesitter = true,
        treesitter_context = true,
        which_key = true,
      },
    },
    specs = {
      {
        "akinsho/bufferline.nvim",
        optional = true,
        opts = function(_, opts)
          if (vim.g.colors_name or ""):find("catppuccin") then
            opts.highlights = require("catppuccin.groups.integrations.bufferline").get()
          end
        end,
      },
    },
  },
}
