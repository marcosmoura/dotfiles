return {
  {
    "f-person/git-blame.nvim",
    event = {
      "BufRead",
    },
  },

  {
    "folke/lazydev.nvim",
    ft = "lua",
    opts = {
      library = {
        { path = "${3rd}/luv/library", words = { "vim%.uv" } },
        { path = "snacks.nvim",        words = { "Snacks" } },
        { path = "LazyVim",            words = { "LazyVim" } },
      },
    },
  },

  {
    "folke/which-key.nvim",
    event = "VeryLazy",
    ft = "json",
    opts_extend = { "spec" },
    opts = {
      spec = {
        {
          mode = { "n", "v" },
          { "<leader>cp", name = "Package dependencies" },
        },
      },
    },
  },

  {
    "vuki656/package-info.nvim",
    cond = function()
      return not vim.g.vscode
    end,
    ft = "json",
    event = "VeryLazy",
    dependencies = { "MunifTanjim/nui.nvim" },
    config = function()
      local set_keymap = vim.api.nvim_set_keymap

      require("package-info").setup({
        autostart = true,
        package_manager = "pnpm",
        hide_up_to_date = false,
        icons = {
          style = {
            up_to_date = "    ",
            outdated = "    ",
            invalid = "    ",
          },
        },
      })

      set_keymap(
        "n",
        "<leader>cpt",
        "<cmd>lua require('package-info').toggle()<cr>",
        { silent = true, noremap = true, desc = "Toggle" }
      )
      set_keymap(
        "n",
        "<leader>cpu",
        "<cmd>lua require('package-info').update()<cr>",
        { silent = true, noremap = true, desc = "Update package" }
      )
      set_keymap(
        "n",
        "<leader>cpc",
        "<cmd>lua require('package-info').change_version()<cr>",
        { silent = true, noremap = true, desc = "Change package version" }
      )
    end,
  },
}
