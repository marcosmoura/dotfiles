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
        illuminate["goto_" .. dir .. "_reference"](false)
      end
    end

    illuminate.configure({
      delay = 1,
    })

    require("which-key").register({
      ["["] = { navigate("prev"), "Go to previous reference" },
      ["]"] = { navigate("next"), "Go to next reference" },
    }, { mode = "n" })
  end,
}
