return {
  {
    "echasnovski/mini.files",
    opts = {
      windows = {
        width_focus = 35,
        width_preview = 60,
      },
      options = {
        use_as_default_explorer = true,
      },
      mappings = {
        close = "<Esc>",
        go_in_plus = "<D-S-Right>",
        go_out_plus = "<D-S-Left>",
      },
    },
    keys = {
      {
        "-",
        function()
          require("mini.files").open(vim.api.nvim_buf_get_name(0), true)
        end,
        desc = "Open mini.files (Directory of Current File)",
      },
    },
    init = function()
      local function augroup(name)
        return vim.api.nvim_create_augroup("custom_" .. name, { clear = true })
      end

      --- Perform an action when the last buffer is deleted
      --- @param callback function
      local function on_last_buffer_deleted(callback)
        return function(event)
          local name = vim.api.nvim_buf_get_name(event.buf or 0)
          local filetype = vim.api.nvim_get_option_value("filetype", { buf = event.buf or 0 })
          local show_dashboard = not name and not filetype

          if show_dashboard then
            callback()
          end
        end
      end

      local function close_minifiles()
        require("mini.files").close()
      end

      -- Open dashboard after last buffer is deleted
      vim.api.nvim_create_autocmd("User", {
        group = augroup("snacks_dashboard"),
        pattern = "BDeletePost",
        callback = on_last_buffer_deleted(function()
          close_minifiles()
          require("snacks").dashboard.open()
          require("snacks").dashboard.update()
        end),
      })

      -- Reload dashboard on session load
      vim.api.nvim_create_autocmd("User", {
        group = augroup("snacks_dashboard"),
        pattern = "PersistenceLoadPost",
        callback = on_last_buffer_deleted(function()
          close_minifiles()
          require("snacks").dashboard.update()
        end),
      })
    end,
  },
}
