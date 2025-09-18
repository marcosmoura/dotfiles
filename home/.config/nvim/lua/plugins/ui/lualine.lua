local none_color = "NONE"

local function parse_hex(int_color)
  return string.format("#%x", int_color)
end

local function get_hlgroup(name, fallback)
  if vim.fn.hlexists(name) == 1 then
    local group = vim.api.nvim_get_hl(0, { name = name })

    local hl = {
      fg = group.fg == nil and none_color or parse_hex(group.fg),
    }

    return hl
  end

  return fallback or {}
end

return {
  {
    "nvim-lualine/lualine.nvim",
    opts = function()
      local diagnostic_icons = LazyVim.config.icons.diagnostics
      local lazy_status = require("lazy.status")
      local colors = require("catppuccin.palettes.mocha")

      colors.bg = none_color

      return {
        options = {
          component_separators = { left = " ", right = "" },
          section_separators = { left = "", right = "" },
          theme = {
            normal = {
              a = { fg = colors.blue, bg = colors.bg },
              b = { fg = colors.cyan, bg = colors.bg },
              c = { fg = colors.text, bg = colors.bg },
              x = { fg = colors.text, bg = colors.bg },
              y = { fg = colors.magenta, bg = colors.bg },
              z = { fg = colors.grey, bg = colors.bg },
            },
            insert = {
              a = { fg = colors.green, bg = colors.bg },
              z = { fg = colors.grey, bg = colors.bg },
            },
            visual = {
              a = { fg = colors.magenta, bg = colors.bg },
              z = { fg = colors.grey, bg = colors.bg },
            },
            terminal = {
              a = { fg = colors.orange, bg = colors.bg },
              z = { fg = colors.grey, bg = colors.bg },
            },
          },
          globalstatus = vim.o.laststatus == 3,
          disabled_filetypes = {
            statusline = { "snacks_dashboard" },
          },
        },
        sections = {
          lualine_a = {
            {
              "mode",
              icon = " ",
            },
          },
          lualine_b = {
            {
              "branch",
              icon = " ",
            },
          },
          lualine_c = {
            {
              "diagnostics",
              always_visible = false,
              symbols = {
                error = diagnostic_icons.error,
                warn = diagnostic_icons.warn,
                info = diagnostic_icons.info,
                hint = diagnostic_icons.hint,
              },
            },
            { "diff" },
          },
          lualine_x = {
            Snacks.profiler.status(),
            {
              lazy_status.updates,
              cond = lazy_status.has_updates,
              color = function()
                return { fg = Snacks.util.color("Special") }
              end,
            },
            {
              function()
                ---@diagnostic disable-next-line: undefined-field
                return require("noice").api.status.mode.get()
              end,
              cond = function()
                ---@diagnostic disable-next-line: undefined-field
                return package.loaded["noice"] and require("noice").api.status.mode.has()
              end,
              color = function()
                return { fg = Snacks.util.color("Constant") }
              end,
            },
            {
              function()
                return "  " .. require("dap").status()
              end,
              cond = function()
                return package.loaded["dap"] and require("dap").status() ~= ""
              end,
              color = function()
                return { fg = Snacks.util.color("Debug") }
              end,
            },
          },
          lualine_y = {},
          lualine_z = {
            {
              "selectioncount",
              color = get_hlgroup("Boolean"),
            },
            {
              "location",
              color = get_hlgroup("Boolean"),
            },
            {
              "encoding",
              color = get_hlgroup("Function"),
            },
            {
              "lsp_status",
              color = get_hlgroup("String"),
              icon = " ",
              ignore_lsp = {
                "null-ls",
                "none-ls",
              },
            },
          },
        },
        extensions = { "lazy", "toggleterm", "mason", "trouble" },
      }
    end,
  },
}
