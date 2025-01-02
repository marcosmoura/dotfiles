return {
  {
    "akinsho/bufferline.nvim",
    version = "*",
    dependencies = {
      {
        "echasnovski/mini.bufremove",
        config = function()
          require("mini.bufremove").setup({
            set_vim_settings = true,
          })
        end,
      },
    },
    event = "VeryLazy",
    config = function()
      local remove_buffer = function(n)
        require("mini.bufremove").delete(n, false)
      end
      require("bufferline").setup({
        highlights = require("catppuccin.groups.integrations.bufferline").get(),
        options = {
          themable = true,
          separator_style = "thick",
          hover = {
            enabled = true,
            delay = 200,
            reveal = { "close" },
          },
          close_command = remove_buffer,
          right_mouse_command = remove_buffer,
          diagnostics = "nvim_lsp",
          always_show_bufferline = true,
          offsets = {
            {
              filetype = "NvimTree",
              text = "File Explorer",
              highlight = "Directory",
              separator = true,
            },
          },
        },
      })
      vim.api.nvim_create_autocmd("BufAdd", {
        callback = function()
          vim.schedule(function()
            pcall(nvim_bufferline)
          end)
        end,
      })
    end,
  },
}
