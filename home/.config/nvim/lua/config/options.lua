-- Vim options
vim.o.cmdheight = 0
vim.opt.backup = false
vim.opt.colorcolumn = "120"
vim.opt.guicursor = "i-ci:ver100,a:blinkon50"
vim.opt.hlsearch = false
vim.opt.incsearch = true
vim.opt.linebreak = true
vim.opt.relativenumber = false
vim.opt.softtabstop = 2
vim.opt.swapfile = false
vim.opt.termguicolors = true
vim.opt.undodir = os.getenv("HOME") .. "/.vim/nvim-undodir"
vim.opt.wrap = true

-- Globals
vim.g.autoformat_enabled = true
vim.g.autopairs_enabled = true
vim.g.cmp_enabled = true
vim.g.diagnostics_mode = 3
vim.g.icons_enabled = true
vim.g.resession_enabled = false
vim.g.ui_notifications_enabled = true

-- Go to previous/next line with h,l,left arrow and right arrow
-- when cursor reaches end/beginning of line
vim.opt.whichwrap:append("<>[]hl")

-- Disable some default providers
vim.g.loaded_node_provider = 0
vim.g.loaded_python3_provider = 0
vim.g.loaded_perl_provider = 0
vim.g.loaded_ruby_provider = 0

-- Disable netrw
vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1

-- LazyVim settings
vim.g.lazyvim_cmp = "blink.cmp"
vim.g.lazyvim_picker = "snacks"
vim.g.root_spec = { ".git", "lsp", "cwd" }

-- Underscore as word character
vim.opt.iskeyword:remove("_")

-- Neovide
if vim.g.neovide then
  vim.g.neovide_text_contrast = 0.01
  vim.g.neovide_text_gamma = 0.01
  vim.opt.linespace = 3

  vim.g.neovide_padding_top = 6
  vim.g.neovide_padding_right = 0
  vim.g.neovide_padding_bottom = 0
  vim.g.neovide_padding_left = 6

  vim.g.neovide_confirm_quit = true
  vim.g.neovide_cursor_animate_in_insert_mode = true
  vim.g.neovide_cursor_animation_length = 0.05
  vim.g.neovide_cursor_smooth_blink = true
  vim.g.neovide_cursor_trail_size = 0
  vim.g.neovide_scroll_animation_length = 0.2

  vim.g.neovide_floating_shadow = false
  vim.g.neovide_transparency = 0.8
  vim.g.neovide_window_blurred = true

  vim.g.neovide_refresh_rate = 240

  vim.api.nvim_set_current_dir("~/Projects")
end
