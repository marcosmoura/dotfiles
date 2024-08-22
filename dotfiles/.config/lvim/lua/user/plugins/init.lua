reload("user.plugins.lsp")
reload("user.plugins.lualine")
reload("user.plugins.nvimtree")
reload("user.plugins.telescope")

local lazy_events = {
  on_file_open = {
    "BufReadPost",
    "BufNewFile",
  },
  on_file_read = {
    "BufRead",
  },
  on_lazy = "VeryLazy",
}

lvim.plugins = {
  {
    "folke/lazy.nvim",
    opts = function(_, opts)
      opts.defaults.lazy = true

      return opts
    end,
  },

  -- Highlight TODOs
  {
    "folke/todo-comments.nvim",
    dependencies = {
      "nvim-lua/plenary.nvim",
    },
    event = lazy_events.on_file_open,
    keys = {
      {
        "<leader>T",
        "<cmd>TodoTelescope<cr>",
        desc = "Open TODO in Telescope",
      },
    },
    opts = {
      search = {
        command = "rg",
      },
    },
  },

  -- Telescope plugins
  {
    "nvim-telescope/telescope-fzf-native.nvim",
    event = lazy_events.on_lazy,
    build = "cmake -S. -Bbuild -DCMAKE_BUILD_TYPE=Release && cmake --build build --config Release && cmake --install build --prefix build",
  },
  {
    "prochri/telescope-all-recent.nvim",
    dependencies = {
      "kkharji/sqlite.lua",
    },
    event = lazy_events.on_lazy,
    config = function()
      local picker = {
        disable = false,
        use_cwd = false,
        sorting = "frecency",
      }

      return {
        default = {
          disable = true,
          use_cwd = true,
          sorting = "recent",
        },
        pickers = {
          find_files = picker,
          git_files = picker,
          ["fzf#native_fzf_sorter"] = picker,
        },
      }
    end,
  },

  -- Community
  { "AstroNvim/astrocommunity" },

  -- Git extensions
  {
    "f-person/git-blame.nvim",
    event = lazy_events.on_file_read,
  },

  -- Theme
  {
    import = "astrocommunity.colorscheme.catppuccin",
  },
  {
    "catppuccin",
    opts = {
      dim_inactive = { enabled = true, percentage = 0.25 },
      integrations = {
        mini = true,
        leap = true,
        markdown = true,
        neotest = true,
        cmp = true,
        overseer = true,
        lsp_trouble = true,
        rainbow_delimiters = true,

        alpha = true,
        dashboard = true,
        flash = true,
        nvimtree = true,
        ts_rainbow = true,
        ts_rainbow2 = true,
        indent_blankline = true,
        navic = true,
        dropbar = true,

        aerial = true,
        dap = { enabled = true, enable_ui = true },
        headlines = true,
        mason = true,
        native_lsp = { enabled = true, inlay_hints = { background = false } },
        neogit = true,
        neotree = true,
        noice = true,
        notify = true,
        sandwich = true,
        semantic_tokens = true,
        symbols_outline = true,
        telescope = { enabled = true },
        which_key = true,
      },
      custom_highlights = {
        TabLineFill = { link = "StatusLine" },
        LspInlayHint = { style = { "italic" } },
        ["@parameter"] = { style = {} },
        ["@type.builtin"] = { style = {} },
        ["@namespace"] = { style = {} },
        ["@text.uri"] = { style = { "underline" } },
        ["@tag.attribute"] = { style = {} },
        ["@tag.attribute.tsx"] = { style = {} },
      },
    },
  },

  -- Copilot
  {
    import = "astrocommunity.completion.copilot-lua",
    event = lazy_events.on_file_open,
  },
  {
    "copilot.lua",
    event = lazy_events.on_file_open,
    opts = {
      suggestion = {
        auto_trigger = true,
        debounce = 0,
        keymap = {
          accept = "<C-l>",
          accept_word = false,
          accept_line = false,
          next = "<C-.>",
          prev = "<C-,>",
          dismiss = "<C/>",
        },
      },
    },
  },

  -- UI
  {
    "stevearc/dressing.nvim",
    event = lazy_events.on_lazy,
  },
  {
    "NvChad/nvim-colorizer.lua",
    event = lazy_events.on_file_open,
  },
  {
    "nacro90/numb.nvim",
    event = lazy_events.on_lazy,
  },
  {
    "rcarriga/nvim-notify",
    event = lazy_events.on_lazy,
    opts = function(_, opts)
      opts.timeout = 3000
      opts.render = "compact"
      opts.stages = "fade_in_slide_out"
    end,
  },
  {
    "lukas-reineke/virt-column.nvim",
    event = lazy_events.on_file_open,
    config = function()
      reload("virt-column").setup()
    end,
  },
  {
    "lewis6991/satellite.nvim",
    event = lazy_events.on_file_open,
    opts = { excluded_filetypes = { "prompt", "TelescopePrompt", "noice", "notify", "neo-tree" } },
  },
  {
    import = "astrocommunity.motion.mini-move",
    event = lazy_events.on_lazy,
  },

  -- Auto session
  {
    "rmagatti/auto-session",
    config = function()
      vim.o.sessionoptions = "blank,buffers,curdir,folds,help,tabpages,winsize,winpos,terminal"
      require("auto-session").setup({
        log_level = "error",
        auto_session_enable_last_session = false,
        auto_save_enabled = true,
        auto_restore_enabled = false,
        auto_session_use_git_branch = true,
        auto_session_suppress_dirs = { "~/" },
        pre_save_cmds = { "NvimTreeClose" },
      })
    end,
  },

  -- -- Others
  {
    "folke/trouble.nvim",
    event = lazy_events.on_file_open,
    cmd = { "TroubleToggle", "Trouble" },
    keys = {
      {
        "<leader>xX",
        "<cmd>TroubleToggle workspace_diagnostics<cr>",
        desc = "Workspace Diagnostics (Trouble)",
      },
      {
        "<leader>xx",
        "<cmd>TroubleToggle document_diagnostics<cr>",
        desc = "Document Diagnostics (Trouble)",
      },
      {
        "<leader>xl",
        "<cmd>TroubleToggle loclist<cr>",
        desc = "Location List (Trouble)",
      },
      {
        "<leader>xq",
        "<cmd>TroubleToggle quickfix<cr>",
        desc = "Quickfix List (Trouble)",
      },
    },
    opts = {
      use_diagnostic_signs = true,
      action_keys = {
        close = { "q", "<esc>" },
        cancel = "<c-e>",
      },
    },
  },
  {
    "folke/edgy.nvim",
    event = lazy_events.on_file_open,
    opts = function(_, opts)
      if not opts.bottom then
        opts.bottom = {}
      end
      table.insert(opts.bottom, "Trouble")
    end,
  },
  {
    import = "astrocommunity.markdown-and-latex.glow-nvim",
    event = lazy_events.on_file_open,
  },
  {
    "mbbill/undotree",
    event = lazy_events.on_file_open,
  },
  {
    "windwp/nvim-ts-autotag",
    event = lazy_events.on_file_open,
  },
  { "goolord/alpha-nvim", enabled = false },
  { "max397574/better-escape.nvim", enabled = false },
  {
    "lvimuser/lsp-inlayhints.nvim",
    event = lazy_events.on_lazy,
  },
}
