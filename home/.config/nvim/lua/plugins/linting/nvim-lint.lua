local lint_events = {
  "BufReadPost",
  "BufWritePost",
  "InsertEnter",
  "InsertLeave",
}

return {
  {
    "mfussenegger/nvim-lint",
    event = "LazyFile",
    opts = {
      events = lint_events,
      linters_by_ft = {
        bash = { "cspell", "shellcheck" },
        css = { "cspell", "stylelint" },
        html = { "cspell", "stylelint" },
        javascript = { "cspell", "eslint_d" },
        javascriptreact = { "cspell", "eslint_d" },
        json = { "cspell", "jsonlint" },
        kdl = { "cspell" },
        lua = { "cspell" },
        markdown = { "cspell", "markdownlint" },
        rust = { "cspell" },
        sh = { "cspell", "shellcheck" },
        typescript = { "cspell", "eslint_d" },
        typescriptreact = { "cspell", "eslint_d" },
        yaml = { "cspell" },
        zsh = { "cspell", "shellcheck" },
      },
      linters = {
        eslint_d = {
          resolve_cwd = function()
            local client = vim.lsp.get_clients({ bufnr = 0 })[1] or {}

            return client.root_dir or vim.fn.fnamemodify(vim.fn.finddir(".git", ".;"), ":h")
          end,
        },
      },
    },
    config = function(_, opts)
      local M = {}

      local lint = require("lint")
      for name, linter in pairs(opts.linters) do
        if type(linter) == "table" and type(lint.linters[name]) == "table" then
          lint.linters[name] = vim.tbl_deep_extend("force", lint.linters[name], linter)
          if type(linter.prepend_args) == "table" then
            lint.linters[name].args = lint.linters[name].args or {}
            vim.list_extend(lint.linters[name].args, linter.prepend_args)
          end
        else
          lint.linters[name] = linter
        end
      end
      lint.linters_by_ft = opts.linters_by_ft

      function M.debounce(ms, fn)
        local timer = vim.uv.new_timer()
        return function(...)
          local argv = { ... }
          timer:start(ms, 0, function()
            timer:stop()
            vim.schedule_wrap(fn)(unpack(argv))
          end)
        end
      end

      function M.lint()
        -- Use nvim-lint's logic first:
        -- * checks if linters exist for the full filetype first
        -- * otherwise will split filetype by "." and add all those linters
        -- * this differs from conform.nvim which only uses the first filetype that has a formatter
        local names = lint._resolve_linter_by_ft(vim.bo.filetype)

        -- Create a copy of the names table to avoid modifying the original.
        names = vim.list_extend({}, names)

        -- Add fallback linters.
        if #names == 0 then
          vim.list_extend(names, lint.linters_by_ft["_"] or {})
        end

        -- Add global linters.
        vim.list_extend(names, lint.linters_by_ft["*"] or {})

        -- Filter out linters that don't exist or don't match the condition.
        local ctx = { filename = vim.api.nvim_buf_get_name(0) }
        ctx.dirname = vim.fn.fnamemodify(ctx.filename, ":h")
        names = vim.tbl_filter(function(name)
          local linter = lint.linters[name]
          if not linter then
            LazyVim.warn("Linter not found: " .. name, { title = "nvim-lint" })
          end
          return linter and not (type(linter) == "table" and linter.condition and not linter.condition(ctx))
        end, names)

        -- Run linters.
        if #names > 0 then
          for _, name in ipairs(names) do
            local linter_config = lint.linters[name] or nil

            if linter_config and type(linter_config.resolve_cwd) == "function" then
              linter_config.cwd = linter_config.resolve_cwd()
            end

            lint.try_lint(name, linter_config)
          end
        end
      end

      vim.api.nvim_create_autocmd(opts.events, {
        group = vim.api.nvim_create_augroup("nvim-lint", { clear = true }),
        callback = M.debounce(100, M.lint),
      })
    end,
  },
}
