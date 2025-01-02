return {
  "RRethy/vim-illuminate",
  event = {
    "BufRead",
    "BufWinEnter",
    "BufNewFile",
  },
  config = function()
    local illuminate = require("illuminate")

    local function navigate(dir)
      return function()
        illuminate["goto_" .. dir .. "_reference"](true)
      end
    end

    illuminate.configure({})

    require("which-key").add({
      mode = "n",
      { ">", navigate("prev"), desc = "Go to previous reference" },
      { "<", navigate("next"), desc = "Go to next reference" },
    })
  end,
}
