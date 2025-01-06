-- Vim options
vim.opt.backup = false
vim.opt.colorcolumn = "120"
vim.opt.guicursor = "i-ci:ver25-Cursor/lCursor-blinkwait1000-blinkon150-blinkoff150"
vim.opt.hlsearch = false
vim.opt.incsearch = true
vim.opt.relativenumber = false
vim.opt.softtabstop = 2
vim.opt.swapfile = false
vim.opt.undodir = os.getenv("HOME") .. "/.vim/nvim-undodir"

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
