-- Vim options
vim.opt.autowrite = true
vim.opt.backup = false
vim.opt.clipboard = "unnamedplus"
vim.opt.colorcolumn = "120"
vim.opt.completeopt = "menu,menuone,noselect"
vim.opt.conceallevel = 3
vim.opt.confirm = true
vim.opt.cursorline = true
vim.opt.expandtab = true
vim.opt.fillchars = {
  foldopen = "",
  foldclose = "",
  fold = " ",
  foldsep = " ",
  diff = "╱",
  eob = " ",
}
vim.opt.formatoptions = "jcroqlnt"
vim.opt.grepformat = "%f:%l:%c:%m"
vim.opt.grepprg = "rg --vimgrep"
vim.opt.guicursor = "i-ci:ver25-Cursor/lCursor-blinkwait1000-blinkon150-blinkoff150"
vim.opt.hlsearch = false
vim.opt.ignorecase = true
vim.opt.inccommand = "nosplit"
vim.opt.incsearch = true
vim.opt.laststatus = 3
vim.opt.list = true
vim.opt.mouse = "a"
vim.opt.number = true
vim.opt.pumblend = 10
vim.opt.pumheight = 10
vim.opt.relativenumber = false
vim.opt.scrolloff = 4
vim.opt.sessionoptions = { "buffers", "curdir", "tabpages", "winsize" }
vim.opt.shiftround = true
vim.opt.shiftwidth = 2
vim.opt.shortmess:append({ W = true, I = true, c = true, C = true })
vim.opt.showmode = false
vim.opt.sidescrolloff = 8
vim.opt.signcolumn = "yes"
vim.opt.smartcase = true
vim.opt.smartindent = true
vim.opt.smoothscroll = true
vim.opt.softtabstop = 2
vim.opt.spelllang = { "en" }
vim.opt.splitbelow = true
vim.opt.splitkeep = "screen"
vim.opt.splitright = true
vim.opt.swapfile = false
vim.opt.tabstop = 2
vim.opt.termguicolors = true
vim.opt.timeoutlen = 300
vim.opt.undodir = os.getenv("HOME") .. "/.vim/nvim-undodir"
vim.opt.undofile = true
vim.opt.undolevels = 10000
vim.opt.updatetime = 50
vim.opt.wildmode = "longest:full,full"
vim.opt.wrap = false

-- Folding
vim.opt.foldlevel = 99
vim.opt.foldtext = "v:lua.require'lazyvim.util.ui'.foldtext()"
vim.opt.foldmethod = "expr"
vim.opt.foldexpr = "v:lua.vim.treesitter.foldexpr()"

-- Globals
vim.g.autoformat_enabled = true
vim.g.autopairs_enabled = true
vim.g.cmp_enabled = true
vim.g.diagnostics_mode = 3
vim.g.icons_enabled = true
vim.g.markdown_recommended_style = 0
vim.g.resession_enabled = false
vim.g.ui_notifications_enabled = true

-- Colorscheme
if not vim.g.vscode then
  vim.cmd.colorscheme("catppuccin")
end
