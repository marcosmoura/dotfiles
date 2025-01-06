return {
  {
    "folke/snacks.nvim",
    opts = {
      animate = {
        fps = 240,
      },
      notifier = {
        timeout = 6000,
      },
      dashboard = {
        preset = {
          header = {
            [[
      ███╗   ██╗███████╗ ██████╗ ██╗   ██╗██╗███╗   ███╗
      ████╗  ██║██╔════╝██╔═══██╗██║   ██║██║████╗ ████║
      ██╔██╗ ██║█████╗  ██║   ██║██║   ██║██║██╔████╔██║
      ██║╚██╗██║██╔══╝  ██║   ██║╚██╗ ██╔╝██║██║╚██╔╝██║
      ██║ ╚████║███████╗╚██████╔╝ ╚████╔╝ ██║██║ ╚═╝ ██║
      ╚═╝  ╚═══╝╚══════╝ ╚═════╝   ╚═══╝  ╚═╝╚═╝     ╚═╝
            ]],
          },
        },
        sections = {
          { section = "header" },
          { icon = " ", title = "Recent Files", section = "recent_files", indent = 2, padding = 1 },
          { icon = " ", title = "Sessions", section = "projects", indent = 2, padding = 1 },
          { icon = " ", title = "Keymaps", section = "keys", indent = 2, padding = 1 },
          { section = "startup" },
        },
      },
    },
  },

  {
    "nvim-lualine/lualine.nvim",

    opts = function(_, opts)
      local icons = LazyVim.config.icons
      local devicons = require("mini.icons")

      local function is_starter_page()
        return vim.bo.filetype == "starter" or vim.bo.buftype ~= ""
      end

      local get_message = function(value, ft)
        local icon = devicons.get("filetype", ft) or ""

        if icon then
          return icon .. "  " .. value
        end

        return value
      end

      local function LSP_section()
        if is_starter_page() then
          return ""
        end

        local empty_msg = "No Active LSP"
        local buffer_type = vim.api.nvim_buf_get_option(0, "filetype")
        local clients = vim.lsp.get_active_clients()

        if not next(clients) == nil then
          return get_message(empty_msg)
        end

        local lsp_list = {}

        for _, client in ipairs(clients) do
          local filetypes = client.config.filetypes

          if filetypes and vim.fn.index(filetypes, buffer_type) ~= -1 then
            table.insert(lsp_list, client.name)
          end
        end

        if #lsp_list > 0 then
          local message = lsp_list[1]

          if #lsp_list == 2 then
            message = table.concat(lsp_list, " and ")
          end

          if #lsp_list > 2 then
            message = "[" .. table.concat(lsp_list, ", ") .. "]"
          end

          return get_message(message, buffer_type)
        end

        return get_message(empty_msg)
      end

      opts.sections.lualine_c = {
        {
          "diagnostics",
          symbols = {
            error = icons.diagnostics.Error .. " ",
            warn = icons.diagnostics.Warn .. " ",
            info = icons.diagnostics.Info .. " ",
            hint = icons.diagnostics.Hint .. " ",
          },
        },
        { "selectioncount" },
      }
      opts.sections.lualine_y = {
        {
          "location",
          padding = {
            left = 1,
            right = 0,
          },
        },
        { "encoding" },
      }
      opts.sections.lualine_z = { { LSP_section } }
      opts.sections.lualine_x[#opts.sections.lualine_x].symbols = {
        added = icons.git.added .. " ",
        modified = icons.git.modified .. " ",
        removed = icons.git.removed .. " ",
      }

      opts.options.section_separators = { left = "", right = "" }
      opts.options.component_separators = { left = " ", right = " " }

      return opts
    end,
  },
}
