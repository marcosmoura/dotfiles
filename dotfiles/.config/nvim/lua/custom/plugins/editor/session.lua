return {
  {
    "echasnovski/mini.sessions",
    version = false,
    lazy = false,
    config = function()
      vim.opt.sessionoptions:append("globals")

      require("mini.sessions").setup({
        directory = "~/.local/share/nvim/sessions",
        file = "",
        hooks = {
          pre = {
            write = function()
              vim.api.nvim_exec_autocmds("User", { pattern = "SessionSavePre" })
            end,
          },
        },
      })
    end,
  },
}
