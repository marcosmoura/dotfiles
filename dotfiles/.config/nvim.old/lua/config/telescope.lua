local builtin = require('telescope.builtin')

vim.keymap.set('n', '<C-p>', builtin.git_files, {})
vim.keymap.set('n', '<leader>sf', builtin.find_files, {})
vim.keymap.set('n', '<leader>sp', function()
  builtin.grep_string({
    search = vim.fn.input('Grep > '),
  })
end, {})

require("telescope").setup {
  defaults = {
    layout_config = {
      horizontal = {
        prompt_position = "top",
        preview_width = 0.5,
        results_width = 0.9,
      },
      vertical = {
        mirror = false,
      },
      width = 0.9,
      height = 0.8,
      preview_cutoff = 120,
    },
    path_display = { "smart" },
  }
}
