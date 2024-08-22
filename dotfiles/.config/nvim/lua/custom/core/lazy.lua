local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
local is_vscode = vim.g.vscode

if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable",
    lazypath,
  })
end

vim.opt.rtp:prepend(lazypath)

require("lazy").setup({
  { import = "custom.plugins" },
  { import = "custom.plugins.coding" },
  { import = "custom.plugins.editor" },
  { import = "custom.plugins.lsp" },
  { import = "custom.plugins.lsp.languages" },
  { import = "custom.plugins.ui" },
}, {
  defaults = {
    lazy = true,
    cond = not is_vscode,
  },

  checker = {
    enabled = true,
    notify = false,
  },

  change_detection = {
    notify = false,
  },

  install = {
    colorscheme = {
      "catppuccin",
    },
  },

  ui = {
    border = "rounded",
    icons = {
      ft = "",
      lazy = "󰂠 ",
      loaded = "",
      not_loaded = "",
    },
  },

  performance = {
    cache = {
      enabled = true,
    },
    rtp = {
      disabled_plugins = {
        "2html_plugin",
        "bugreport",
        "compiler",
        "ftplugin",
        "getscript",
        "getscriptPlugin",
        "gzip",
        "logipat",
        "matchit",
        "netrw",
        "netrwFileHandlers",
        "netrwPlugin",
        "netrwSettings",
        "optwin",
        "rplugin",
        "rrhelper",
        "spellfile_plugin",
        "synmenu",
        "syntax",
        "tar",
        "tarPlugin",
        "tohtml",
        "tutor",
        "vimball",
        "vimballPlugin",
        "zip",
        "zipPlugin",
      },
    },
  },
})
