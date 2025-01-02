return {
  "ibhagwan/fzf-lua",
  dependencies = {
    "nvim-tree/nvim-web-devicons",
  },
  event = "VeryLazy",
  config = function()
    local function title(str)
      return { { "  " .. (str or "Find Files") .. "  ", "IncSearch" } }
    end

    local hls = {
      bg = "PmenuSbar",
      sel = "PmenuSel",
    }

    local default_rg_opts =
      "--color=never --no-heading --with-filename --line-number --column --smart-case --hidden --glob=!.git/"

    require("fzf-lua").setup({
      "telescope",
      fzf_opts = {
        ["--ansi"] = "",
        ["--info"] = "inline",
        ["--height"] = "100%",
        ["--layout"] = "reverse",
        ["--border"] = "none",
        ["--prompt"] = "❯",
        ["--pointer"] = "❯",
        ["--marker"] = "❯",
        ["--no-scrollbar"] = "",
        ["--reverse"] = "",
      },
      winopts = {
        title = "Search",
        title_pos = "center",
        width = 0.5,
        height = 0.5,
        border = "rounded",
        hls = {
          title = "IncSearch",
          border = hls.bg,
          preview_border = hls.bg,
          scrollfloat_e = "",
          scrollfloat_f = hls.sel,
        },
        preview = {
          hidden = "hidden",
          default = "bat",
        },
      },
      help_tags = {
        winopts = {
          title = title("Help"),
          width = 0.6,
          height = 0.5,
        },
      },
      keymaps = {
        winopts = {
          title = title("Keymaps"),
          width = 0.6,
          height = 0.6,
        },
      },
      commands = {
        winopts = {
          title = title("Commands"),
          width = 0.7,
          height = 0.7,
        },
      },
      grep = {
        winopts = {
          title = title("Search"),
          width = 0.7,
          height = 0.8,
          preview = {
            hidden = "nohidden",
            vertical = "down:60%",
            horizontal = "right:60%",
            layout = "vertical",
            flip_columns = 120,
          },
        },
        rg_opts = default_rg_opts,
      },
      oldfiles = {
        cwd_only = true,
        winopts = {
          title = title("Recent files"),
          width = 0.6,
          height = 0.5,
        },
      },
      files = {
        winopts = {
          title = title(),
        },
        rg_opts = default_rg_opts,
      },
      git = {
        files = {
          winopts = {
            title = title(),
          },
          rg_opts = default_rg_opts,
        },
        branches = {
          winopts = {
            title = title("Git branches"),
            width = 0.6,
            height = 0.6,
          },
        },
        commits = {
          winopts = {
            title = title("Git commits"),
            width = 0.6,
            height = 0.6,
          },
        },
      },
    })

    require("which-key").add({
      mode = "n",
      { "<leader>f", "<cmd>FzfLua files<cr>", desc = "Find Files" },
      {
        "<leader>s",
        "<cmd>FzfLua live_grep<cr>",
        desc = "Search",
        group = "search",
        { "<leader>sg", "<cmd>FzfLua git_files<cr>", desc = "Git: Files" },
        { "<leader>sb", "<cmd>FzfLua git_branches<cr>", desc = "Git: Checkout branch" },
        { "<leader>sc", "<cmd>FzfLua git_commits<cr>", desc = "Git: List commits" },
        { "<leader>sh", "<cmd>FzfLua help_tags<cr>", desc = "Help" },
        { "<leader>sk", "<cmd>FzfLua keymaps<cr>", desc = "Keymaps" },
        { "<leader>sr", "<cmd>FzfLua oldfiles<cr>", desc = "Recent files" },
        { "<leader>st", "<cmd>FzfLua live_grep<cr>", desc = "Text" },
        {
          "<leader>sT",
          function()
            require("fzf-lua").grep({
              search = "TODO|BUG|FIX|ISSUE|WARNING",
              no_esc = true,
            })
          end,
          desc = "Search Todo",
        },
      },
    })
  end,
}
