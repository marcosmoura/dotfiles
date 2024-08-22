return {
  {
    "nvim-tree/nvim-tree.lua",
    cmd = { "NvimTreeToggle", "NvimTreeFocus" },
    event = "BufWinEnter",
    config = function()
      local which_key = require("which-key")
      local nvim_tree = require("nvim-tree")
      local nvim_tree_api = require("nvim-tree.api")

      nvim_tree.setup({
        filters = {
          dotfiles = true,
        },
        auto_close = true,
        disable_netrw = true,
        hijack_netrw = true,
        hijack_cursor = true,
        hijack_unnamed_buffer_when_opening = false,
        sync_root_with_cwd = true,
        update_focused_file = {
          enable = true,
          update_root = false,
        },
        view = {
          side = "left",
          width = 45,
          preserve_window_proportions = true,
        },
        git = {
          enable = true,
          ignore = true,
        },
        filesystem_watchers = {
          enable = true,
        },
        on_attach = function(bufnr)
          vim.keymap.set("n", "<CR>", nvim_tree_api.node.open.tab_drop, {
            desc = "nvim-tree: Tab drop",
            buffer = bufnr,
            noremap = true,
            silent = true,
            nowait = true,
          })
        end,
        actions = {
          open_file = {
            resize_window = true,
          },
        },
        renderer = {
          root_folder_label = true,
          highlight_git = true,
          highlight_opened_files = "none",

          indent_markers = {
            enable = true,
          },

          icons = {
            show = {
              file = true,
              folder = true,
              folder_arrow = true,
              git = true,
            },

            glyphs = {
              default = "󰈚",
              symlink = "",
              folder = {
                default = "",
                empty = "",
                empty_open = "",
                open = "",
                symlink = "",
                symlink_open = "",
                arrow_open = "",
                arrow_closed = "",
              },
              git = {
                unstaged = "✗",
                staged = "✓",
                unmerged = "",
                renamed = "➜",
                untracked = "★",
                deleted = "",
                ignored = "◌",
              },
            },
          },
        },
      })

      local function open_nvim_tree(data)
        local directory = vim.fn.isdirectory(data.file) == 1

        if not directory then
          return
        end

        vim.cmd.cd(data.file)

        nvim_tree_api.tree.open({ focus = false, find_file = true })
      end

      vim.api.nvim_create_autocmd({ "VimEnter" }, { callback = open_nvim_tree })

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

      which_key.register({
        ["<leader>"] = {
          e = {
            function()
              nvim_tree_api.tree.toggle({
                path = vim.loop.cwd(),
                current_window = false,
                find_file = true,
                update_root = false,
                focus = true,
              })
            end,
            "Toggle NvimTree",
          },
        },
      })
    end,
  },
}
