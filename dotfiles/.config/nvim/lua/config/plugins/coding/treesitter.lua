return {
  {
    "nvim-treesitter/nvim-treesitter",
    cmd = {
      "TSInstall",
      "TSUninstall",
      "TSUpdate",
      "TSUpdateSync",
      "TSInstallInfo",
      "TSInstallSync",
      "TSInstallFromGrammar",
    },
    version = false,
    event = {
      "BufRead",
      "BufWinEnter",
      "BufNewFile",
    },
    build = ":TSUpdate",
    config = function()
      require("nvim-treesitter.configs").setup({
        ensure_installed = {
          "bash",
          "comment",
          "html",
          "javascript",
          "json",
          "json5",
          "jsonc",
          "lua",
          "markdown",
          "markdown_inline",
          "query",
          "regex",
          "tsx",
          "typescript",
          "vim",
          "vimdoc",
          "yaml",
        },

        highlight = {
          enable = true,
          disable = {
            "css",
          },
        },

        indent = {
          enable = true,
          disable = {
            "yaml",
            "python",
          },
        },

        autotag = {
          enable = true,
        },

        autopairs = {
          enable = true,
        },

        rainbow = {
          enable = true,
          extended_mode = true,
        },

        incremental_selection = {
          enable = true,
          keymaps = {
            init_selection = "<C-space>",
            node_incremental = "<C-space>",
            scope_incremental = false,
            node_decremental = "<bs>",
          },
        },
      })
    end,
  },
}
