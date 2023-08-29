--- Reload the entire configuration
function reload_config()
  for name, _ in pairs(package.loaded) do
    if name:match('^user') and not name:match('nvim-tree') then
      package.loaded[name] = nil
    end
  end

  dofile(vim.env.MYVIMRC)
  vim.notify("Nvim configuration reloaded!", vim.log.levels.INFO)
end

local nvchad_mappings = {
  -- In order to disable a default keymap, use
  disabled = {
    n = {
      ["<leader>ff"] = "",
    }
  },

  -- Your custom mappings
  custom = {
    n = {
      -- Enable transparency
      ["<leader>tt"] = {
        function()
          require("base46").toggle_transparency()
        end,
        "toggle transparency",
      },

      -- Trigger telescope
      ["<C-p>"] = { ":Telescope git_files <CR>", "Telescope Git" },
      ["<C-s>"] = { ":Telescope find_files <CR>", "Telescope All" },

      -- Reload Vim configuration
      ["<leader><leader><leader>x"] = { reload_config, "Reload Vim configuration" },
    },
  }
}

return nvchad_mappings
