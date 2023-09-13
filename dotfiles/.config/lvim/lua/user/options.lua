-- Vim globals
vim.opt.backup = false
vim.opt.colorcolumn = "120"
vim.opt.expandtab = true
vim.opt.guicursor = "i-ci:ver25-Cursor/lCursor-blinkwait1000-blinkon150-blinkoff150"
vim.opt.hlsearch = false
vim.opt.incsearch = true
vim.opt.list = true
vim.opt.number = true
vim.opt.relativenumber = false
vim.opt.scrolloff = 8
vim.opt.shiftwidth = 2
vim.opt.signcolumn = "yes"
vim.opt.smartindent = true
vim.opt.softtabstop = 2
vim.opt.spell = false
vim.opt.swapfile = false
vim.opt.tabstop = 2
vim.opt.termguicolors = true
vim.opt.undodir = os.getenv("HOME") .. "/.vim/undodir"
vim.opt.undofile = true
vim.opt.updatetime = 50
vim.opt.wrap = false

vim.g.autoformat_enabled = true
vim.g.autopairs_enabled = true
vim.g.cmp_enabled = true
vim.g.diagnostics_mode = 3
vim.g.icons_enabled = true
vim.g.mapleader = " "
vim.g.resession_enabled = false
vim.g.ui_notifications_enabled = true

-- LunarVim options
lvim.colorscheme = "catppuccin-mocha"
lvim.format_on_save.enabled = true
lvim.transparent_window = true
lvim.builtin.breadcrumbs.active = false
