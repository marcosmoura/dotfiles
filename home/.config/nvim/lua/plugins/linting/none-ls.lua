local os = require("os")
local spell_dictionary = os.getenv("HOME") .. "/.config/cspell/dictionaries/custom.txt"

return {
  {
    "nvimtools/none-ls.nvim",
    event = {
      "BufReadPost",
      "BufWritePost",
      "InsertEnter",
      "InsertLeave",
    },
    config = function()
      local null_ls = require("null-ls")

      local cspell_diagnostics = function(bufnr, lnum, cursor_col)
        local diagnostics = {}

        for _, diagnostic in ipairs(vim.diagnostic.get(bufnr, { lnum = lnum })) do
          if diagnostic.source == "cspell" and cursor_col >= diagnostic.col and cursor_col < diagnostic.end_col then
            table.insert(diagnostics, diagnostic)
          end
        end

        return diagnostics
      end

      local sort_spell_dictionary = function()
        vim.fn.system(string.format("sort -u %s -o %s", spell_dictionary, spell_dictionary))
      end

      null_ls.register({
        name = "cspell",
        method = { null_ls.methods.CODE_ACTION },
        filetypes = { "_all" },
        generator = {
          fn = function(params)
            local diagnostics = cspell_diagnostics(params.bufnr, params.row - 1, params.col)

            if #diagnostics == 0 then
              return {
                {
                  title = "Code Spell: Mark word as wrong",
                  action = function()
                    -- write the current word to the spell_dictionary and sort the file afterwards with unique lines
                    local word = vim.fn.expand("<cword>")

                    vim.fn.system(string.format("echo '!%s' >> %s", word, spell_dictionary))
                    require("lint").try_lint("cspell")
                    sort_spell_dictionary()
                  end,
                },
              }
            end

            return {
              {
                title = "Code Spell: Mark word as correct",
                action = function()
                  -- in case the word is already in the spell_dictionary (the format is !word) remove it
                  -- in case the word is not in the spell_dictionary, add it
                  -- sort the file afterwards with unique lines
                  local word = vim.fn.expand("<cword>")

                  -- find the word in the spell_dictionary
                  local grep_cmd = string.format("grep -q '!%s' %s", word, spell_dictionary)

                  -- remove the word from the spell_dictionary
                  local sed_cmd = string.format("sed -i '' '/!%s/d' %s", word, spell_dictionary)

                  -- add the word to the spell_dictionary
                  local echo_cmd = string.format("echo '%s' >> %s", word, spell_dictionary)

                  -- run the commands
                  vim.fn.system(string.format("%s && %s || %s", grep_cmd, sed_cmd, echo_cmd))
                  require("lint").try_lint("cspell")
                  sort_spell_dictionary()
                end,
              },
            }
          end,
        },
      })
    end,
  },
}
