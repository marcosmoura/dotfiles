return {
  "echasnovski/mini.statusline",
  version = "*",
  config = function()
    local statusline = require("mini.statusline")

    local icons = {
      error = "󰅚",
      warning = "",
      hint = "󰛩",
      info = "",
      git = "",
      plugin = "",
      vim = "",
    }

    local function stbufnr()
      return vim.api.nvim_win_get_buf(vim.g.statusline_winid)
    end

    local function is_starter_page()
      return vim.bo.filetype == "starter" or vim.bo.buftype ~= ""
    end

    local function section_git()
      if not vim.b[stbufnr()].gitsigns_head or vim.b[stbufnr()].gitsigns_git_status then
        return ""
      end

      return string.format(" %s %s", icons.git, vim.b[stbufnr()].gitsigns_status_dict.head)
    end

    local function section_fileinfo(args)
      if is_starter_page() then
        return ""
      end

      local get_icon = function(filetype)
        local devicons_present, devicons = pcall(require, "nvim-web-devicons")
        local default_icon = "󰈚"

        if devicons_present then
          local icon = devicons.get_icon(filetype)

          return (icon ~= nil and icon) or default_icon
        end

        return default_icon
      end

      local filetype = vim.bo.filetype
      local encoding = vim.bo.fileencoding or vim.bo.encoding
      local format = vim.bo.fileformat

      if filetype == "" or vim.bo.buftype ~= "" or encoding == "" or format == "" then
        return ""
      end

      if statusline.is_truncated(args.trunc_width) then
        return filetype
      end

      return string.format("%s %s  %s  %s", get_icon(filetype), filetype, encoding, format)
    end

    local function section_location()
      return "[%l, %c]"
    end

    local function section_diagnostics(args)
      if is_starter_page() then
        return ""
      end

      if not rawget(vim, "lsp") then
        return string.format(" %s 0 %s 0", icons.error, icons.warning)
      end

      local get_LSP_item = function(type)
        return #vim.diagnostic.get(stbufnr(), { severity = vim.diagnostic.severity[type] }) or 0
      end

      if statusline.is_truncated(args.trunc_width) then
        local format = function(value, icon)
          return string.format("%s %s", icon, value)
        end

        local errors = get_LSP_item("ERROR")
        local warnings = get_LSP_item("WARN")
        local hints = get_LSP_item("HINT")
        local infos = get_LSP_item("INFO")
        local items = { "", format(errors, icons.error), format(warnings, icons.warning) }

        if hints > 0 then
          table.insert(items, format(hints, icons.hint))
        end

        if infos > 0 then
          table.insert(items, format(infos, icons.hint))
        end

        return table.concat(items, " ")
      end

      return " "
    end

    local function section_LSP()
      if is_starter_page() then
        return ""
      end

      local get_message = function(value)
        return string.format("%s %s", icons.vim, value)
      end

      local empty_msg = "No Active Lsp"
      local buf_ft = vim.api.nvim_buf_get_option(0, "filetype")
      local clients = vim.lsp.get_active_clients()

      if not next(clients) == nil then
        return get_message(empty_msg)
      end

      local LSP_msg = {}
      for _, client in ipairs(clients) do
        local filetypes = client.config.filetypes
        if filetypes and vim.fn.index(filetypes, buf_ft) ~= -1 then
          table.insert(LSP_msg, client.name)
        end
      end

      if #LSP_msg > 0 then
        return get_message(table.concat(LSP_msg, ","))
      end

      return get_message(empty_msg)
    end

    local function section_lazy_updates()
      local Checker = require("lazy.manage.checker")
      local updates = #Checker.updated

      return updates > 0 and string.format(" %s %s Lazy updates", icons.plugin, updates) or ""
    end

    local config = {
      content = {
        active = function()
          local mode, mode_hl = statusline.section_mode({ trunc_width = 120 })
          local spell = vim.wo.spell and (statusline.is_truncated(120) and "S" or "SPELL") or ""
          local git = section_git()
          local diagnostics = section_diagnostics({ trunc_width = 75 })
          local searchcount = statusline.section_searchcount({ trunc_width = 140 })
          local fileinfo = section_fileinfo({ trunc_width = 120 })
          local location = section_location()
          local lsp = section_LSP()
          local lazy = section_lazy_updates()

          return statusline.combine_groups({
            { hl = mode_hl, strings = { mode, spell } },
            { hl = "MiniStatuslineDevinfo", strings = { git, diagnostics } },
            "%=",
            { strings = { lazy } },
            "%=",
            { strings = { lsp } },
            { strings = { fileinfo } },
            { strings = { searchcount, location } },
          })
        end,
        inactive = function()
          local filename = statusline.section_filename({ trunc_width = 140 })
          return statusline.combine_groups({
            { strings = { filename } },
          })
        end,
      },
    }

    statusline.setup(config)

    vim.opt.laststatus = 3
  end,
}
