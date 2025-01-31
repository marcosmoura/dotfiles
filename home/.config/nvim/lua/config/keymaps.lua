-- Mappings
vim.keymap.set("n", "Q", "<nop>")
vim.keymap.set("n", "W", "<nop>")
vim.keymap.set({ "x", "n", "s" }, "<leader>w", "<cmd>w<cr><esc>", { desc = "Save File" })
vim.keymap.set({ "x", "i", "n", "s" }, "<D-s>", "<ESC><cmd>w<cr><esc>", { desc = "Save File" })

-- Neovide
if vim.g.neovide then
  vim.api.nvim_set_keymap("v", "<D-c>", '"+y', { noremap = true })
  vim.api.nvim_set_keymap("n", "<D-v>", 'l"+P', { noremap = true })
  vim.api.nvim_set_keymap("v", "<D-v>", '"+P', { noremap = true })
  vim.api.nvim_set_keymap("c", "<D-v>", '<C-o>l<C-o>"+<C-o>P<C-o>l', { noremap = true })
  vim.api.nvim_set_keymap("i", "<D-v>", '<ESC>l"+Pli', { noremap = true })
  vim.api.nvim_set_keymap("t", "<D-v>", '<C-\\><C-n>"+Pi', { noremap = true })
end
