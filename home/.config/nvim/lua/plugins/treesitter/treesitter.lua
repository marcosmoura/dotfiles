return {
  {
    "nvim-treesitter/nvim-treesitter",
    opts = {
      ensure_installed = {
        "bash",
        "comment",
        "html",
        "javascript",
        "json",
        "json5",
        "jsonc",
        "kdl",
        "lua",
        "markdown_inline",
        "markdown",
        "query",
        "regex",
        -- [work] not available: rust, yaml
        "tsx",
        "typescript",
        "vim",
        "vimdoc",
      },
    },
  },
}
