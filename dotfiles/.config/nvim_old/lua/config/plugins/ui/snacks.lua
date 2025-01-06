return {
  {
    "folke/snacks.nvim",
    priority = 1000,
    lazy = false,
    dependencies = {
      "folke/which-key.nvim",
    },
    config = function()
      require("snacks").setup({
        animate = {
          duration = 20, -- ms per step
          easing = "linear",
          fps = 240, -- frames per second. Global setting for all animations
        },
        notifier = {
          timeout = 6000, -- default timeout in ms
        },
        bigfile = { enabled = true },
        dashboard = {
          sections = {
            { section = "header" },
            { icon = " ", title = "Recent Files", section = "recent_files", indent = 2, padding = 1 },
            { icon = " ", title = "Sessions", section = "projects", indent = 2, padding = 1 },
            { icon = " ", title = "Keymaps", section = "keys", indent = 2, padding = 1 },
            { section = "startup" },
          },
        },
        indent = { enabled = true },
        lazygit = {
          enabled = true,
        },
        input = { enabled = true },
        quickfile = { enabled = true },
        scroll = { enabled = true },
        statuscolumn = { enabled = true },
        terminal = { enabled = true },
        words = { enabled = true },
      })

      local Snacks = require("snacks")

      require("which-key").add({
        {
          "<leader>g",
          function()
            Snacks.lazygit()
          end,
          desc = "Lazy Git",
        },
        {
          "<leader>pp",
          function()
            Snacks.profiler.toggle()
          end,
          desc = "Show Profiler",
        },
        {
          "<leader>ph",
          function()
            Snacks.profiler.highlight(true)
          end,
          desc = "Show Profiler Highlights",
        },
        {
          "<leader>t",
          function()
            Snacks.terminal.toggle()
          end,
          desc = "Show Profiler Highlights",
        },
      })
    end,
  },
}
