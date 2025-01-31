return {
  {
    "nvim-neo-tree/neo-tree.nvim",
    enabled = false,
    opts = {
      window = {
        position = "right",
        width = 45,
      },
      filesystem = {
        filtered_items = {
          hide_dotfiles = false,
          hide_gitignored = false,
          hide_by_name = {
            "node_modules",
            ".cache",
            "dist",
            "tmp",
            "temp",
            ".swc",
            ".session.vim",
            ".git",
          },
          never_show = {
            ".DS_Store",
          },
        },
      },
      default_component_configs = {
        icon = {
          provider = function(icon, node)
            local success, web_devicons = pcall(require, "nvim-web-devicons")
            local name = node.type == "terminal" and "terminal" or node.name

            if success then
              local devicon, hl = web_devicons.get_icon(name)

              icon.text = (devicon or icon.text) .. " "
              icon.highlight = hl or icon.highlight
            end
          end,
        },
      },
    },
  },
}
