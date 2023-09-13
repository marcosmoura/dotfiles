local dropdown = reload("telescope.themes").get_dropdown({
  border = true,
  shorten_path = false,
  -- results_title = "",
  -- prompt_title = "",
  previewer = false,
  hidden = true,
})

lvim.builtin.telescope.defaults.color_devicons = true
lvim.builtin.telescope.defaults.entry_prefix = "  "
lvim.builtin.telescope.defaults.file_ignore_patterns = { "node_modules", "dist", ".git" }
lvim.builtin.telescope.defaults.initial_mode = "insert"
lvim.builtin.telescope.defaults.layout_config.anchor = "N"
lvim.builtin.telescope.defaults.path_display = { "truncate" }
lvim.builtin.telescope.defaults.path_display.truncate = 3
lvim.builtin.telescope.defaults.prompt_prefix = "   "
lvim.builtin.telescope.defaults.selection_caret = "  "
lvim.builtin.telescope.defaults.set_env = { ["COLORTERM"] = "truecolor" }
lvim.builtin.telescope.defaults.theme = dropdown
lvim.builtin.telescope.extensions.fzf.case_mode = "ignore_case"
lvim.builtin.telescope.extensions.fzf.fuzzy = true
lvim.builtin.telescope.extensions.fzf.override_file_sorter = true
lvim.builtin.telescope.extensions.fzf.override_generic_sorter = true
lvim.builtin.telescope.pickers.find_files = dropdown
lvim.builtin.telescope.pickers.git_files = dropdown
lvim.builtin.telescope.pickers.grep_string = dropdown

lvim.builtin.telescope.on_config_done = function(telescope)
  pcall(telescope.load_extension, "fzf")

  -- Recency picker
  local picker = {
    disable = false,
    use_cwd = false,
    sorting = "frecency",
  }

  require("telescope-all-recent").setup({
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
  })
end
