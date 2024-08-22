local previewers = require("telescope.previewers")
local sorters = require("telescope.sorters")

lvim.builtin.telescope.defaults.color_devicons = true
lvim.builtin.telescope.defaults.entry_prefix = "  "
lvim.builtin.telescope.defaults.file_ignore_patterns = { "node_modules", "dist", ".git" }
lvim.builtin.telescope.defaults.file_previewer = previewers.vim_buffer_cat.new
lvim.builtin.telescope.defaults.file_sorter = sorters.get_fuzzy_file
lvim.builtin.telescope.defaults.generic_sorter = sorters.get_generic_fuzzy_sorter
lvim.builtin.telescope.defaults.grep_previewer = previewers.vim_buffer_vimgrep.new
lvim.builtin.telescope.defaults.initial_mode = "insert"
lvim.builtin.telescope.defaults.layout_config = { anchor = "N", width = 0.5, height = 0.5 }
lvim.builtin.telescope.defaults.path_display = { "truncate" }
lvim.builtin.telescope.defaults.prompt_prefix = "   "
lvim.builtin.telescope.defaults.qflist_previewer = previewers.vim_buffer_qflist.new
lvim.builtin.telescope.defaults.selection_caret = "  "
lvim.builtin.telescope.defaults.set_env = { ["COLORTERM"] = "truecolor" }
lvim.builtin.telescope.defaults.shorten_path = true
lvim.builtin.telescope.defaults.theme = "dropdown"
lvim.builtin.telescope.extensions.fzf.case_mode = "ignore_case"
lvim.builtin.telescope.extensions.fzf.fuzzy = true
lvim.builtin.telescope.extensions.fzf.override_file_sorter = true
lvim.builtin.telescope.extensions.fzf.override_generic_sorter = true

lvim.builtin.telescope.extensions.find_files.hidden = true
lvim.builtin.telescope.extensions.find_files.previewer = true

lvim.builtin.telescope.extensions.git_files.hidden = true
lvim.builtin.telescope.extensions.git_files.previewer = true
lvim.builtin.telescope.extensions.git_files.show_untracked = true

lvim.builtin.telescope.extensions.git_branches.show_remote_tracking_branches = false
lvim.builtin.telescope.extensions.git_branches.theme = "dropdown"
lvim.builtin.telescope.extensions.git_branches.layout_config = {
  width = 0.6,
  height = 0.5,
}

lvim.builtin.telescope.extensions.git_commits.theme = "dropdown"
lvim.builtin.telescope.extensions.git_commits.layout_config = {
  width = 0.6,
  height = 0.5,
}

lvim.builtin.telescope.extensions.commands.theme = "dropdown"
lvim.builtin.telescope.extensions.commands.layout_config = {
  width = 0.7,
  height = 0.8,
}

lvim.builtin.telescope.extensions.help_tags.theme = "dropdown"
lvim.builtin.telescope.extensions.help_tags.layout_config = {
  width = 0.6,
  height = 0.4,
}

lvim.builtin.telescope.extensions.keymaps.theme = "dropdown"
lvim.builtin.telescope.extensions.keymaps.layout_config = {
  width = 0.7,
  height = 0.8,
}

lvim.builtin.telescope.extensions.oldfiles.theme = "dropdown"
lvim.builtin.telescope.extensions.oldfiles.layout_config = {
  width = 0.6,
  height = 0.35,
}

lvim.builtin.telescope.extensions.live_grep.only_sort_text = true

lvim.builtin.telescope.on_config_done = function(telescope)
  pcall(telescope.load_extension, "fzf")

  require("telescope-all-recent").setup({
    default = {
      disable = true,
      use_cwd = true,
      sorting = "recent",
    },
    pickers = {
      ["fzf#native_fzf_sorter"] = {
        disable = false,
        use_cwd = false,
        sorting = "frecency",
      },
    },
  })
end
