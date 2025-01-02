return {
  {
    "nvim-tree/nvim-tree.lua",
    cmd = { "NvimTreeToggle", "NvimTreeFocus" },
    dependencies = {
      "nvim-tree/nvim-web-devicons",
    },
    event = "VimEnter",
    config = function()
      local nvim_tree_api = require("nvim-tree.api")

      require("nvim-tree").setup({
        sort = {
          sorter = "case_sensitive",
        },
        diagnostics = {
          enable = true,
          show_on_dirs = false,
        },
        sync_root_with_cwd = true,
        open_on_tab = false,
        filters = {
          dotfiles = false,
          custom = {},
        },
        git = {
          enable = true,
        },
        view = {
          adaptive_size = true,
          side = "right",
          width = 45,
        },
        renderer = {
          group_empty = true,
          highlight_git = true,
          highlight_diagnostics = true,
          highlight_bookmarks = "all",
          highlight_clipboard = "all",

          icons = {
            webdev_colors = false,
            git_placement = "after",
            modified_placement = "after",
            glyphs = {
              git = {
                -- Git style symbols
                unstaged = "U",
                staged = "A",
                unmerged = "M",
                renamed = "R",
                untracked = "?",
                deleted = "D",
                ignored = "!",
              },
            },
          },
          special_files = {
            "Cargo.toml",
            "Makefile",
            "CMakeLists.txt",
            "config.bash",
            "config.sh",
            "config",
            "README.md",
            "readme.md",
            "LICENSE",
            "DEVELOPMENT.md",
            "DEVELOPING.md",
            "package.json",
            ".nvimrc",
          },
        },
      })

      local prev = { new_name = "", old_name = "" }
      vim.api.nvim_create_autocmd("User", {
        pattern = "NvimTreeSetup",
        callback = function()
          local events = nvim_tree_api.events

          events.subscribe(events.Event.NodeRenamed, function(data)
            if prev.new_name ~= data.new_name or prev.old_name ~= data.old_name then
              data = data
              Snacks.rename.on_rename_file(data.old_name, data.new_name)
            end
          end)
        end,
      })

      vim.api.nvim_create_autocmd({ "BufWinEnter" }, {
        callback = function()
          require("nvim-tree.api").tree.open({
            path = vim.loop.cwd(),
            current_window = false,
            find_file = true,
            update_root = false,
            focus = false,
          })
        end,
      })

      vim.api.nvim_create_autocmd("QuitPre", {
        callback = function()
          local tree_wins = {}
          local floating_wins = {}
          local wins = vim.api.nvim_list_wins()
          for _, w in ipairs(wins) do
            local bufname = vim.api.nvim_buf_get_name(vim.api.nvim_win_get_buf(w))
            if bufname:match("NvimTree_") ~= nil then
              table.insert(tree_wins, w)
            end
            if vim.api.nvim_win_get_config(w).relative ~= "" then
              table.insert(floating_wins, w)
            end
          end
          if 1 == #wins - #floating_wins - #tree_wins then
            -- Should quit, so we close all invalid windows.
            for _, w in ipairs(tree_wins) do
              vim.api.nvim_win_close(w, true)
            end
          end
        end,
      })

      require("which-key").add({
        "<leader>e",
        function()
          nvim_tree_api.tree.toggle({
            path = vim.loop.cwd(),
            current_window = false,
            find_file = true,
            update_root = false,
            focus = true,
          })
        end,
        desc = "Toggle File Explorer",
      })
    end,
  },
}
