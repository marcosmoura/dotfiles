-- Create a autocmd to update yazi instance when BufRead
vim.api.nvim_create_autocmd({ "BufEnter", "BufWinEnter" }, {
  group = vim.api.nvim_create_augroup("YaziReveal", { clear = true }),
  callback = function()
    vim.fn.jobstart("ya emit-to 999 reveal " .. vim.fn.expand("%:p"))
  end,
})
