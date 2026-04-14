local workspaces = require("workspaces")

return {
  font = {
    text = "Maple Mono NF",
    icons = "Hugeicons Stroke Rounded",
  },

  icons = {
    font_size = 17,
    width = 26
  },

  bar = {
    height = 28,
    margin = 12,
    y_offset = 12,
    corner_radius = 12,
    padding = 0,
  },

  item = {
    corner_radius = 12,
    height = 28,
  },

  popup = {
    corner_radius = 12,
    height = 32,
    y_offset = 4,
    font_size = 14.0,
    animation = {
      curve = "sin",
      duration = 12,
      travel = 12,
      exit_delay_s = 0.12,
    },
  },

  workspace_order = workspaces.order,
}
