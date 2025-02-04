return {
  { import = "lazyvim.plugins.extras.editor.mini-files" },

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
      {
        "<leader>e",
        function()
          require("mini.files").open(vim.uv.cwd(), true)
        end,
        desc = "Open mini.files (cwd)",
      },
    },
  },
}
