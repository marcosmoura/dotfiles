local ts_files = {
  "test.tsx",
  "types.ts",
  "style.ts",
  "styles.ts",
  "cy.ts",
  "cy.tsx",
}

return {
  "nvim-neo-tree/neo-tree.nvim",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "nvim-tree/nvim-web-devicons",
    "MunifTanjim/nui.nvim",
  },
  cmd = "Neotree",
  keys = {
    {
      "<leader>e",
      function()
        require("neo-tree.command").execute({ toggle = true, dir = vim.loop.cwd() })
      end,
      desc = "Explorer NeoTree",
    },
  },
  deactivate = function()
    vim.cmd([[Neotree close]])
  end,
  init = function()
    if vim.fn.argc() == 1 then
      local stat = vim.loop.fs_stat(vim.fn.argv(0))
      if stat and stat.type == "directory" then
        require("neo-tree")
      end
    end
  end,
  opts = {
    close_if_last_window = true,
    sources = { "filesystem", "buffers", "git_status", "document_symbols" },
    nesting_rules = {
      ["env"] = { "env", "envrc", "env.d.ts" },
      ["c"] = { "h" },
      ["css"] = { "css.map", "module.css" },
      ["ts"] = ts_files,
      ["tsx"] = ts_files,
      ["azure-pipelines.yml"] = { "yml" },
    },
    filesystem = {
      bind_to_cwd = false,
      follow_current_file = {
        enabled = true,
        leave_dirs_open = true,
      },
      use_libuv_file_watcher = true,
      filtered_items = {
        visible = true,
        hide_dotfiles = false,
        never_show = {
          ".DS_Store",
          "thumbs.db",
          "node_modules",
        },
      },
    },
    window = {
      width = 45,
      mappings = {
        ["<space>"] = "none",
      },
    },
    default_component_configs = {
      indent = {
        padding = 2,
        with_expanders = true,
        expander_collapsed = "",
        expander_expanded = "",
        expander_highlight = "NeoTreeExpander",
      },
    },
  },
}
