local formatters = require("null-ls.builtins").formatting
local actions = require("null-ls.builtins").code_actions
local linters = require("null-ls.builtins").diagnostics

reload("lvim.lsp.null-ls.formatters").setup({
  formatters.prettier,
  formatters.shfmt,
  formatters.stylelint,
  formatters.stylua,
})

reload("lvim.lsp.null-ls.linters").setup({
  linters.shellcheck,
})

reload("lvim.lsp.null-ls.code_actions").setup({
  actions.shellcheck,
})
