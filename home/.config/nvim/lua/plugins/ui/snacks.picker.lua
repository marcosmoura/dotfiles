return {
  {
    "folke/snacks.nvim",
    opts = {
      picker = {
        sources = {
          files = {
            hidden = true,
          },
          git_files = {
            untracked = true,
          },
          explorer = {
            hidden = true,
            layout = {
              layout = {
                position = "right",
              },
            },
          },
        },
        matcher = {
          frecency = true,
          sort_empty = true,
        },
      },
    },
    init = function()
      --- Create an autogroup
      --- @param name string
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

      -- Reload dashboard on session load
      vim.api.nvim_create_autocmd("User", {
        group = augroup("snacks_dashboard"),
        pattern = "BufReadPost",
        callback = on_last_buffer_deleted(function()
          -- Reload dashboard after 100ms
          vim.defer_fn(function()
            require("snacks").dashboard.update()
          end, 100)
        end),
      })
    end,
  },
}
