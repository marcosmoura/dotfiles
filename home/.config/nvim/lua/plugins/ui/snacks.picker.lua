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
          grep = {
            hidden = true,
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
  },
}
