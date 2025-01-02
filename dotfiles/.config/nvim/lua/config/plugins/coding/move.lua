return {
  "echasnovski/mini.move",
  version = "*",
  event = {
    "BufRead",
    "BufWinEnter",
    "BufNewFile",
  },
  config = function()
    local minimove = require("mini.move")

    local move = function(direction)
      return {
        function()
          minimove.move_line(direction)
        end,
        "Move line " .. direction,
      }
    end

    minimove.setup({
      -- Move visual selection in Visual mode. Defaults are Alt (Meta) + hjkl.
      up = "<M-up>",
      right = "<M-right>",
      down = "<M-down>",
      left = "<M-left>",

      -- Move current line in Normal mode
      line_up = "<M-up>",
      line_right = "<M-right>",
      line_down = "<M-down>",
      line_left = "<M-left>",
    })
  end,
}
