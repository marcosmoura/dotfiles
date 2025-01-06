return {
  "echasnovski/mini.hipatterns",
  version = "*",
  event = "VeryLazy",
  config = function()
    local hipatterns = require("mini.hipatterns")
    local make_pattern_in_comment = function(pattern)
      return function(buf_id)
        local cs = vim.bo[buf_id].commentstring
        if cs == nil or cs == "" then
          cs = "# %s"
        end

        local left, right = cs:match("^(.*)%%s(.-)$")
        left, right = vim.trim(left), vim.trim(right)

        return string.format("^%%s*%s%%s*()%s().*%s%%s*$", vim.pesc(left), pattern, vim.pesc(right))
      end
    end
    local get_highlighter = function(pattern, group)
      return {
        pattern = make_pattern_in_comment(pattern),
        group,
      }
    end

    hipatterns.setup({
      delay = {
        scroll = 10,
        text_change = 150,
      },
      highlighters = {
        todo = get_highlighter("TODO", "MiniHipatternsTodo"),
        hack = get_highlighter("HACK", "MiniHipatternsHack"),
        warning = get_highlighter("WARNING", "MiniHipatternsHack"),
        note = get_highlighter("NOTE", "MiniHipatternsNote"),
        fix = get_highlighter("FIX", "MiniHipatternsFixme"),
        fixme = get_highlighter("FIXME", "MiniHipatternsFixme"),
        bug = get_highlighter("BUG", "MiniHipatternsFixme"),
        issue = get_highlighter("ISSUE", "MiniHipatternsFixme"),
        hex_color = hipatterns.gen_highlighter.hex_color(),
      },
    })
  end,
}
