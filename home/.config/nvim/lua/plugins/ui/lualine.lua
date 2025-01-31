return {
  {
    "nvim-lualine/lualine.nvim",
    opts = function()
      local devicons = require("mini.icons")
      local diagnosticsIcons = LazyVim.config.icons.diagnostics

      local function is_starter_page()
        return vim.bo.filetype == "starter" or vim.bo.buftype ~= ""
      end

      local function get_message(value, ft)
        local icon = devicons.get("filetype", ft) or ""
        return icon and (icon .. "  " .. value) or value
      end

      local function LSP_section()
        if is_starter_page() then
          return ""
        end

        local empty_msg = "No Active LSP"
        local buffer_type = vim.bo.filetype
        local clients = vim.lsp.get_clients({ bufnr = 0 })

        if vim.tbl_isempty(clients) then
          return get_message(empty_msg)
        end

        local lsp_list = {}
        for _, client in ipairs(clients) do
          ---@diagnostic disable-next-line: undefined-field
          if vim.tbl_contains(client.config.filetypes or {}, buffer_type) then
            table.insert(lsp_list, client.name)
          end
        end

        if #lsp_list == 0 then
          return get_message(empty_msg)
        end

        local message = table.concat(lsp_list, ", ")
        if #lsp_list > 2 then
          message = "[" .. message .. "]"
        end

        return get_message(message, buffer_type)
      end

      local function parse_hex(int_color)
        return string.format("#%x", int_color)
      end

      local function get_hlgroup(name, fallback)
        if vim.fn.hlexists(name) == 1 then
          local group = vim.api.nvim_get_hl(0, { name = name })

          local hl = {
            fg = group.fg == nil and "NONE" or parse_hex(group.fg),
          }

          return hl
        end

        return fallback or {}
      end

      return {
        options = {
          component_separators = { left = " ", right = " " },
          section_separators = { left = " ", right = " " },
          theme = "cyberdream",
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
                error = diagnosticsIcons.error,
                warn = diagnosticsIcons.warn,
                info = diagnosticsIcons.info,
                hint = diagnosticsIcons.hint,
              },
            },
            { "diff" },
          },
          lualine_x = {
            Snacks.profiler.status(),
            {
              require("lazy.status").updates,
              cond = require("lazy.status").has_updates,
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
              LSP_section,
              color = get_hlgroup("String"),
            },
          },
        },
        extensions = { "lazy", "toggleterm", "mason", "trouble" },
      }
    end,
  },
}
