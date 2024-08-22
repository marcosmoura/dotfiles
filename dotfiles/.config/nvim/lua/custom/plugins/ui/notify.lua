return {
  "rcarriga/nvim-notify",
  event = "VeryLazy",
  opts = {
    timeout = 3000,
    stages = "fade_in_slide_out",
    max_height = function()
      return math.floor(vim.o.lines * 0.75)
    end,
    max_width = function()
      return math.floor(vim.o.columns * 0.75)
    end,
  },
  init = function()
    require("which-key").register({
      ["<leader>"] = {
        u = {
          name = "UI",
          n = {
            function()
              require("notify").dismiss({ silent = true, pending = true })
            end,
            "Dismiss all Notifications",
          },
        },
      },
    })
  end,
}
