local config = {
  defaults = {
    vimgrep_arguments = {
      "--color=never",
      "--no-heading",
      "--with-filename",
      "--line-number",
      "--column",
      "--smart-case",
    },

    layout_config = {
      anchor = "N"
    },
    path_display = { truncate = 3 },
  },

  pickers = {
    find_files = require('telescope.themes').get_dropdown({
      preview_title = "",
      results_title = "",
      prompt_title = "",
      hidden = true
    })
  },

  extensions = {
    fzf = {
      fuzzy = true,
      override_generic_sorter = true,
      override_file_sorter = true,
      case_mode = "smart_case",
    }
  },

  extensions_list = {
    "fzf"
  }
}


return config
