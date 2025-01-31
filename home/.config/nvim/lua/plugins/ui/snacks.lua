return {
  {
    "folke/snacks.nvim",
    opts = {
      animate = {
        fps = 240,
      },
      notifier = {
        timeout = 6000,
        top_down = false,
      },
      picker = {
        sources = {
          files = {
            hidden = true,
          },
          git_files = {
            untracked = true,
          },
        },
      },
    },
  },
}
