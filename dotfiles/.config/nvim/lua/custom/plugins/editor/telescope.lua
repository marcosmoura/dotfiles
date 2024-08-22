return {
  "nvim-telescope/telescope.nvim",
  version = false,
  dependencies = {
    { "nvim-telescope/telescope-fzf-native.nvim", build = "make" },
    "stevearc/dressing.nvim",
    "nvim-lua/plenary.nvim",
    "nvim-telescope/telescope-ui-select.nvim",
  },
  event = "VeryLazy",
  config = function()
    local telescope = require("telescope")
    local previewers = require("telescope.previewers")
    local sorters = require("telescope.sorters")

    telescope.setup({
      defaults = {
        color_devicons = true,
        entry_prefix = "  ",
        file_ignore_patterns = { "node_modules", "dist", ".git" },
        initial_mode = "insert",
        path_display = { truncate = 3 },
        prompt_prefix = "   ",
        selection_caret = "  ",
        set_env = { ["COLORTERM"] = "truecolor" },
        border = true,
        shorten_path = false,
        results_title = false,
        layout_strategy = "vertical",
        layout_config = {
          vertical = {
            prompt_position = "top",
          },
          anchor = "N",
          mirror = true,
          width = 0.5,
          height = 0.5,
        },
        theme = "dropdown",
        vimgrep_arguments = {
          "rg",
          "--color=never",
          "--no-heading",
          "--with-filename",
          "--line-number",
          "--column",
          "--smart-case",
          "--hidden",
          "--glob=!.git/",
        },
      },
      file_previewer = previewers.vim_buffer_cat.new,
      grep_previewer = previewers.vim_buffer_vimgrep.new,
      qflist_previewer = previewers.vim_buffer_qflist.new,
      file_sorter = sorters.get_fuzzy_file,
      generic_sorter = sorters.get_generic_fuzzy_sorter,
      pickers = {
        find_files = {
          hidden = true,
          previewer = false,
        },
        git_files = {
          hidden = true,
          previewer = false,
          show_untracked = true,
        },
        git_branches = {
          show_remote_tracking_branches = false,
          theme = "dropdown",
          layout_strategy = "vertical",
          layout_config = {
            vertical = {
              prompt_position = "top",
            },
            anchor = "N",
            width = 0.6,
            height = 0.5,
          },
        },
        git_commits = {
          theme = "dropdown",
          layout_strategy = "vertical",
          layout_config = {
            vertical = {
              prompt_position = "top",
            },
            anchor = "N",
            width = 0.6,
            height = 0.5,
          },
        },
        commands = {
          theme = "dropdown",
          layout_strategy = "vertical",
          layout_config = {
            vertical = {
              prompt_position = "top",
            },
            anchor = "N",
            width = 0.7,
            height = 0.8,
          },
        },
        help_tags = {
          theme = "dropdown",
          layout_strategy = "vertical",
          layout_config = {
            vertical = {
              prompt_position = "top",
            },
            anchor = "N",
            width = 0.6,
            height = 0.4,
          },
        },
        keymaps = {
          theme = "dropdown",
          layout_strategy = "vertical",
          layout_config = {
            vertical = {
              prompt_position = "top",
            },
            anchor = "N",
            width = 0.7,
            height = 0.8,
          },
        },
        oldfiles = {
          theme = "dropdown",
          layout_strategy = "vertical",
          layout_config = {
            vertical = {
              prompt_position = "top",
            },
            anchor = "N",
            width = 0.6,
            height = 0.35,
          },
        },
        live_grep = {
          only_sort_text = true,
          theme = "dropdown",
          layout_strategy = "vertical",
          layout_config = {
            vertical = {
              prompt_position = "top",
            },
            anchor = "N",
            width = 0.7,
            height = 0.5,
          },
        },
        grep_string = {
          only_sort_text = true,
        },
      },
      extensions = {
        ["ui-select"] = {
          theme = "dropdown",
          layout_strategy = "vertical",
          layout_config = {
            vertical = {
              prompt_position = "top",
            },
            anchor = "N",
            width = 0.6,
            height = 0.35,
          },
        },
      },
    })

    telescope.load_extension("ui-select")
    telescope.load_extension("fzf")
  end,
}
