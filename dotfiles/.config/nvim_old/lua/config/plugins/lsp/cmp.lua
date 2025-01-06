local icon_map = {
  Array = "[]",
  BladeNav = "",
  Boolean = "",
  Calendar = "",
  Class = "󰠱",
  Codeium = "",
  Color = "󰏘",
  Constant = "󰏿",
  Constructor = "",
  Copilot = "",
  Enum = "",
  EnumMember = "",
  Event = "",
  Field = "󰜢",
  File = "󰈚",
  Folder = "󰉋",
  Function = "󰆧",
  Interface = "",
  Keyword = "󰌋",
  Method = "󰆧",
  Module = "",
  Namespace = "󰌗",
  Null = "󰟢",
  Number = "",
  Object = "󰅩",
  Operator = "󰆕",
  Package = "",
  Property = "󰜢",
  Reference = "󰈇",
  Snippet = "",
  String = "󰉿",
  Struct = "󰙅",
  Supermaven = "",
  Table = "",
  TabNine = "",
  Tag = "",
  Text = "󰉿",
  TypeParameter = "󰊄",
  Unit = "󰑭",
  Value = "󰎠",
  Variable = "󰀫",
  Watch = "󰥔",
}

local function format(_, item)
  local icon = " " .. (icon_map[item.kind] or "") .. " "
  local label = item.abbr
  local truncated_label = vim.fn.strcharpart(label, 0, 70)

  item.menu = "   (" .. item.kind .. ")"
  item.kind = icon

  if truncated_label ~= label then
    item.abbr = truncated_label .. "..."
  end

  return item
end

return {
  "hrsh7th/nvim-cmp",
  event = "InsertEnter",
  dependencies = {
    "echasnovski/mini.pairs",
    "hrsh7th/cmp-buffer",
    "hrsh7th/cmp-nvim-lsp",
    "hrsh7th/cmp-nvim-lua",
    "hrsh7th/cmp-path",
    "L3MON4D3/LuaSnip",
    "onsails/lspkind.nvim",
    "saadparwaiz1/cmp_luasnip",
  },
  config = function()
    local cmp = require("cmp")

    cmp.setup({
      mapping = cmp.mapping.preset.insert({
        ["<Tab>"] = cmp.mapping(function(fallback)
          if cmp.visible() then
            cmp.select_next_item()
          elseif require("luasnip").expand_or_jumpable() then
            vim.fn.feedkeys(vim.api.nvim_replace_termcodes("<Plug>luasnip-expand-or-jump", true, true, true), "")
          else
            fallback()
          end
        end, {
          "i",
          "s",
        }),
        ["<S-Tab>"] = cmp.mapping(function(fallback)
          if cmp.visible() then
            cmp.select_prev_item()
          elseif require("luasnip").jumpable(-1) then
            vim.fn.feedkeys(vim.api.nvim_replace_termcodes("<Plug>luasnip-jump-prev", true, true, true), "")
          else
            fallback()
          end
        end, {
          "i",
          "s",
        }),

        -- `Enter` key to confirm completion
        ["<CR>"] = cmp.mapping.confirm({
          behavior = cmp.ConfirmBehavior.Replace,
          select = false,
        }),

        -- Ctrl+Space to trigger completion menu
        ["<C-Space>"] = cmp.mapping.complete(),

        -- Scroll up and down in the completion documentation
        ["<C-u>"] = cmp.mapping.scroll_docs(-4),
        ["<C-d>"] = cmp.mapping.scroll_docs(4),
      }),
      completion = {
        completeopt = "menu,menuone",
      },

      window = {
        completion = {
          scrollbar = false,
          side_padding = 0,
          winhighlight = "Normal:CmpPmenu,CursorLine:CmpSel,Search:None,FloatBorder:CmpBorder",
          border = "single",
        },

        documentation = {
          border = "single",
          winhighlight = "Normal:CmpDoc,FloatBorder:CmpDocBorder",
        },
      },

      snippet = {
        expand = function(args)
          require("luasnip").lsp_expand(args.body)
        end,
      },

      formatting = {
        fields = { "kind", "abbr", "menu" },

        format = format,
      },

      sources = cmp.config.sources({
        { name = "nvim_lsp" },
        { name = "buffer" },
        { name = "path" },
        { name = "nvim_lua" },
        { name = "luasnip" },
        {
          name = "lazydev",
          group_index = 0,
        },
      }),
    })

    cmp.setup({})
  end,
}
