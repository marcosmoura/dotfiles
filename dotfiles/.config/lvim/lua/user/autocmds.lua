vim.api.nvim_create_autocmd("FileType", {
  pattern = { "zsh" },
  callback = function() require("nvim-treesitter.highlight").attach(0, "bash") end,
})
