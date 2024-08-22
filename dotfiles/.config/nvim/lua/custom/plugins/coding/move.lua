return {
  "echasnovski/mini.move",
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

    minimove.setup()

    require("which-key").register({
      ["<M-up>"] = move("up"),
      ["<M-right>"] = move("right"),
      ["<M-down>"] = move("down"),
      ["<M-left>"] = move("left"),
      ["<M-k>"] = move("up"),
      ["<M-l>"] = move("right"),
      ["<M-j>"] = move("down"),
      ["<M-h>"] = move("left"),
    })
  end,
}
