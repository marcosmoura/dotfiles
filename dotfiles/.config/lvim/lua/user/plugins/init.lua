reload("user.plugins.lsp")
reload("user.plugins.lualine")
reload("user.plugins.nvimtree")
reload("user.plugins.telescope")

lvim.plugins = {
  -- Highlight TODOs
  {
    "folke/todo-comments.nvim",
    dependencies = {
      "nvim-lua/plenary.nvim",
    },
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
    build = "cmake -S. -Bbuild -DCMAKE_BUILD_TYPE=Release && cmake --build build --config Release && cmake --install build --prefix build",
  },
  {
    "prochri/telescope-all-recent.nvim",
    dependencies = {
      "kkharji/sqlite.lua",
    },
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
  { "f-person/git-blame.nvim" },

  -- Theme
  { import = "astrocommunity.colorscheme.catppuccin" },
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
  { import = "astrocommunity.completion.copilot-lua" },
  {
    "copilot.lua",
    opts = {
      suggestion = {
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
  { "stevearc/dressing.nvim" },
  { "NvChad/nvim-colorizer.lua" },
  { "nacro90/numb.nvim" },
  {
    "rcarriga/nvim-notify",
    opts = function(_, opts)
      opts.timeout = 3000
      opts.render = "compact"
      opts.stages = "fade_in_slide_out"
    end,
  },
  {
    "lukas-reineke/virt-column.nvim",
    config = function()
      reload("virt-column").setup()
    end,
  },
  {
    "lewis6991/satellite.nvim",
    opts = { excluded_filetypes = { "prompt", "TelescopePrompt", "noice", "notify", "neo-tree" } },
  },
  {
    "folke/zen-mode.nvim",
    opts = function(_, opts)
      local old_on_open, old_on_close = opts.on_open, opts.on_close
      opts.on_open = function()
        utils.conditional_func(old_on_open, true)
        vim.cmd.SatelliteDisable()
      end
      opts.on_close = function()
        utils.conditional_func(old_on_close, true)
        vim.cmd.SatelliteEnable()
      end
    end,
  },
  { import = "astrocommunity.motion.mini-move" },

  -- Auto session
  {
    "rmagatti/auto-session",
    config = function()
      vim.o.sessionoptions = "blank,buffers,curdir,folds,help,tabpages,winsize,winpos,terminal"
      require("auto-session").setup({
        log_level = "error",
        auto_session_enable_last_session = true,
        auto_save_enabled = true,
        auto_restore_enabled = true,
        auto_session_use_git_branch = true,
        auto_session_suppress_dirs = { "~/" },
        pre_save_cmds = { "NvimTreeClose" },
      })
    end,
  },
  {
    "rmagatti/session-lens",
    dependencies = { "rmagatti/auto-session", "nvim-telescope/telescope.nvim" },
    config = function()
      require("session-lens").setup({
        previewer = false,
        theme_conf = { layout_strategy = "vertical", borderchars = lvim.builtin.telescope.defaults.borderchars },
      })
      require("telescope").load_extension("session-lens")
    end,
  },

  -- -- Others
  {
    "folke/trouble.nvim",
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
    opts = function(_, opts)
      if not opts.bottom then
        opts.bottom = {}
      end
      table.insert(opts.bottom, "Trouble")
    end,
  },
  { import = "astrocommunity.markdown-and-latex.glow-nvim" },
  "mbbill/undotree",
  "windwp/nvim-ts-autotag",
  { "goolord/alpha-nvim", enabled = false },
  { "max397574/better-escape.nvim", enabled = false },
  { "lvimuser/lsp-inlayhints.nvim" },
}
