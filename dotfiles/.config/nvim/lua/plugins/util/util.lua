return {
  { import = "lazyvim.plugins.extras.vscode" },

  {
    "folke/persistence.nvim",
    event = "BufReadPre",
    opts = {
      need = 0,
    },
  },
}
